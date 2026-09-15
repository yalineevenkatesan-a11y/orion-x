package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/fsnotify/fsnotify"
	"github.com/gorilla/websocket"
)

type ASTNode struct {
	FilePath string   `json:"file_path"`
	Imports  []string `json:"imports"`
	LOC      int      `json:"loc"`
}

var (
	upgrader = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	clients  = make(map[*websocket.Conn]bool)
	mutex    = sync.Mutex{}
)

func parseImports(path string) ([]string, int) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, 0
	}
	lines := strings.Split(string(data), "\n")
	var imports []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "import ") || strings.HasPrefix(trimmed, "from ") || strings.HasPrefix(trimmed, "require(") {
			imports = append(imports, trimmed)
		}
	}
	return imports, len(lines)
}

func watchWorkspace(rootPath string, broadcast chan<- ASTNode) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Fatal(err)
	}
	defer watcher.Close()

	filepath.Walk(rootPath, func(path string, info os.FileInfo, err error) error {
		if err == nil && info.IsDir() && !strings.Contains(path, "node_modules") && !strings.Contains(path, ".git") && !strings.Contains(path, ".next") && !strings.Contains(path, "dist") {
			watcher.Add(path)
		}
		return nil
	})

	for {
		select {
		case event, ok := <-watcher.Events:
			if !ok {
				return
			}
			if event.Op&(fsnotify.Write|fsnotify.Create) != 0 {
				ext := filepath.Ext(event.Name)
				if ext == ".ts" || ext == ".tsx" || ext == ".js" || ext == ".jsx" || ext == ".py" || ext == ".go" {
					relPath, err := filepath.Rel(rootPath, event.Name)
					if err != nil {
						relPath = event.Name
					}
					imports, loc := parseImports(event.Name)
					node := ASTNode{FilePath: filepath.ToSlash(relPath), Imports: imports, LOC: loc}
					broadcast <- node
				}
			}
		case err, ok := <-watcher.Errors:
			if !ok {
				return
			}
			log.Println("Watcher error:", err)
		}
	}
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	mutex.Lock()
	clients[conn] = true
	mutex.Unlock()

	defer func() {
		mutex.Lock()
		delete(clients, conn)
		mutex.Unlock()
		conn.Close()
	}()

	// Keep alive reader
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func main() {
	broadcast := make(chan ASTNode, 100)
	targetDir := "."
	if len(os.Args) > 1 {
		targetDir = os.Args[1]
	}

	absTarget, _ := filepath.Abs(targetDir)
	fmt.Printf("[ORION-X AST ENGINE] Watching: %s\n", absTarget)

	go watchWorkspace(targetDir, broadcast)

	http.HandleFunc("/ws/ast", wsHandler)
	go func() {
		for node := range broadcast {
			payload, err := json.Marshal(node)
			if err != nil {
				continue
			}
			fmt.Printf("[AST EVENT] %s\n", string(payload))
			mutex.Lock()
			for conn := range clients {
				conn.WriteMessage(websocket.TextMessage, payload)
			}
			mutex.Unlock()
		}
	}()

	fmt.Println("[ORION-X AST ENGINE] Daemon running on :9042 (/ws/ast)")
	log.Fatal(http.ListenAndServe(":9042", nil))
}
