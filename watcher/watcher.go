package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// FileASTPayload represents the atomic extraction structure
type FileASTPayload struct {
	File    string   `json:"file"`
	Imports []string `json:"imports"`
	Exports []string `json:"exports"`
	LOC     int      `json:"loc"`
}

// Global state for socket clients and deduplication
type Server struct {
	clients   map[net.Conn]bool
	clientMux sync.Mutex
	broadcast chan []byte
}

var (
	serverInstance = &Server{
		clients:   make(map[net.Conn]bool),
		broadcast: make(chan []byte, 256),
	}

	// Regex for JS / TS imports & exports
	reJSImport = regexp.MustCompile(`(?m)^\s*(?:import\s+(?:(?:[\w*\s{},]*)\s+from\s+)?['"]([^'"]+)['"]|const\s+.*=\s*require\(['"]([^'"]+)['"]\))`)
	reJSExport = regexp.MustCompile(`(?m)^\s*export\s+(?:default\s+)?(?:const|let|var|function\*?|class|interface|type|enum)?\s*([a-zA-Z0-9_$]+)`)

	// Regex for Python imports & exports
	rePyImport     = regexp.MustCompile(`(?m)^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.,\s]+))`)
	rePyExportFunc = regexp.MustCompile(`(?m)^\s*(?:def|class)\s+([a-zA-Z0-9_]+)`)

	// Regex for Go imports & exports
	reGoSingleImport = regexp.MustCompile(`(?m)^\s*import\s+["']([^"']+)["']`)
	reGoExportIdent  = regexp.MustCompile(`(?m)^\s*(?:func(?:\s*\([^)]+\))?\s+|type\s+|var\s+|const\s+)([A-Z][a-zA-Z0-9_]*)`)

	// Ignore common large/generated directories
	ignoredDirs = map[string]bool{
		".git":         true,
		"node_modules": true,
		"dist":         true,
		".next":        true,
		"build":        true,
		"out":          true,
		"vendor":       true,
		".vscode":      true,
		"__pycache__":  true,
		".venv":        true,
	}
)

func main() {
	dirPath := flag.String("dir", ".", "Repository root directory to observe")
	port := flag.String("port", "9042", "Local TCP socket port for AST broadcasting")
	initialScan := flag.Bool("initial-scan", true, "Perform immediate recursive scan on launch")
	flag.Parse()

	absDir, err := filepath.Abs(*dirPath)
	if err != nil {
		log.Fatalf("[WATCHER FATAL] Failed to resolve directory: %v", err)
	}

	fmt.Printf("[ORION-X GO AST WATCHER] Starting observer on: %s\n", absDir)
	fmt.Printf("[ORION-X GO AST WATCHER] Binding atomic TCP socket to localhost:%s\n", *port)

	// Start TCP socket broadcast server in background
	go startSocketServer(*port)

	// Concurrency Worker Pool for parsing AST payloads
	jobQueue := make(chan string, 500)
	var wg sync.WaitGroup
	numWorkers := 4
	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go astWorker(jobQueue, absDir, &wg)
	}

	// Initial scan if requested
	if *initialScan {
		fmt.Println("[WATCHER SCAN] Initiating recursive baseline repository scan...")
		go func() {
			err := filepath.Walk(absDir, func(path string, info os.FileInfo, err error) error {
				if err != nil {
					return nil
				}
				if info.IsDir() {
					if ignoredDirs[info.Name()] {
						return filepath.SkipDir
					}
					return nil
				}
				if isSupportedFile(path) {
					jobQueue <- path
				}
				return nil
			})
			if err != nil {
				log.Printf("[WATCHER WARN] Baseline scan encounter error: %v", err)
			}
		}()
	}

	// Initialize multi-threaded fsnotify watcher
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Fatalf("[WATCHER FATAL] Unable to initialize fsnotify: %v", err)
	}
	defer watcher.Close()

	// Recursively register directories
	registerDirs(watcher, absDir)

	// Debounce buffer for file write bursts
	debounceMap := make(map[string]time.Time)
	var debounceMux sync.Mutex

	// Event listener loop
	for {
		select {
		case event, ok := <-watcher.Events:
			if !ok {
				return
			}

			// Add newly created directories to watcher
			if event.Has(fsnotify.Create) {
				fi, err := os.Stat(event.Name)
				if err == nil && fi.IsDir() {
					base := filepath.Base(event.Name)
					if !ignoredDirs[base] {
						_ = watcher.Add(event.Name)
						registerDirs(watcher, event.Name)
					}
				}
			}

			// Process Write or Create events on supported files
			if event.Has(fsnotify.Write) || event.Has(fsnotify.Create) {
				if isSupportedFile(event.Name) {
					debounceMux.Lock()
					lastTime, exists := debounceMap[event.Name]
					now := time.Now()
					if !exists || now.Sub(lastTime) > 200*time.Millisecond {
						debounceMap[event.Name] = now
						debounceMux.Unlock()
						jobQueue <- event.Name
					} else {
						debounceMux.Unlock()
					}
				}
			}

		case err, ok := <-watcher.Errors:
			if !ok {
				return
			}
			log.Printf("[WATCHER ERROR] fsnotify event error: %v", err)
		}
	}
}

// Worker function processing files from queue
func astWorker(jobs <-chan string, rootDir string, wg *sync.WaitGroup) {
	for filePath := range jobs {
		payload, err := parseFileAST(filePath, rootDir)
		if err != nil {
			continue
		}

		jsonData, err := json.Marshal(payload)
		if err != nil {
			continue
		}

		// 1. Emit atomic JSON payload to stdout line-by-line
		fmt.Println(string(jsonData))

		// 2. Broadcast to local TCP socket clients
		serverInstance.broadcastPayload(jsonData)
	}
}

// Parse file imports, exports, and line counts
func parseFileAST(absPath, rootDir string) (*FileASTPayload, error) {
	file, err := os.Open(absPath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	relPath, err := filepath.Rel(rootDir, absPath)
	if err != nil {
		relPath = absPath
	}
	relPath = filepath.ToSlash(relPath)

	ext := strings.ToLower(filepath.Ext(absPath))
	contentBytes, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}
	content := string(contentBytes)

	// Calculate non-empty Lines of Code (LOC)
	scanner := bufio.NewScanner(strings.NewReader(content))
	loc := 0
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" && !strings.HasPrefix(line, "//") && !strings.HasPrefix(line, "#") {
			loc++
		}
	}

	importsSet := make(map[string]bool)
	exportsSet := make(map[string]bool)

	switch ext {
	case ".js", ".jsx", ".ts", ".tsx":
		// Imports
		matches := reJSImport.FindAllStringSubmatch(content, -1)
		for _, m := range matches {
			if len(m) > 1 && m[1] != "" {
				importsSet[m[1]] = true
			} else if len(m) > 2 && m[2] != "" {
				importsSet[m[2]] = true
			}
		}
		// Exports
		expMatches := reJSExport.FindAllStringSubmatch(content, -1)
		for _, m := range expMatches {
			if len(m) > 1 && m[1] != "" && m[1] != "default" {
				exportsSet[m[1]] = true
			}
		}

	case ".py":
		// Imports
		matches := rePyImport.FindAllStringSubmatch(content, -1)
		for _, m := range matches {
			if len(m) > 1 && m[1] != "" {
				importsSet[m[1]] = true
			} else if len(m) > 2 && m[2] != "" {
				for _, item := range strings.Split(m[2], ",") {
					cleaned := strings.TrimSpace(item)
					if cleaned != "" {
						importsSet[cleaned] = true
					}
				}
			}
		}
		// Exports (top-level functions and classes)
		expMatches := rePyExportFunc.FindAllStringSubmatch(content, -1)
		for _, m := range expMatches {
			if len(m) > 1 && m[1] != "" && !strings.HasPrefix(m[1], "_") {
				exportsSet[m[1]] = true
			}
		}

	case ".go":
		// Single imports
		matches := reGoSingleImport.FindAllStringSubmatch(content, -1)
		for _, m := range matches {
			if len(m) > 1 && m[1] != "" {
				importsSet[m[1]] = true
			}
		}
		// Block imports
		inImportBlock := false
		lines := strings.Split(content, "\n")
		for _, l := range lines {
			trimmed := strings.TrimSpace(l)
			if strings.HasPrefix(trimmed, "import (") {
				inImportBlock = true
				continue
			}
			if inImportBlock {
				if trimmed == ")" {
					inImportBlock = false
					continue
				}
				impMatch := regexp.MustCompile(`["']([^"']+)["']`).FindStringSubmatch(trimmed)
				if len(impMatch) > 1 {
					importsSet[impMatch[1]] = true
				}
			}
		}
		// Exports (Capitalized identifiers in Go)
		expMatches := reGoExportIdent.FindAllStringSubmatch(content, -1)
		for _, m := range expMatches {
			if len(m) > 1 && m[1] != "" {
				exportsSet[m[1]] = true
			}
		}
	}

	importsList := make([]string, 0, len(importsSet))
	for imp := range importsSet {
		importsList = append(importsList, imp)
	}

	exportsList := make([]string, 0, len(exportsSet))
	for exp := range exportsSet {
		exportsList = append(exportsList, exp)
	}

	return &FileASTPayload{
		File:    relPath,
		Imports: importsList,
		Exports: exportsList,
		LOC:     loc,
	}, nil
}

// Checks if extension matches supported target files
func isSupportedFile(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	return ext == ".js" || ext == ".jsx" || ext == ".ts" || ext == ".tsx" || ext == ".py" || ext == ".go"
}

// Recursively register all directories with fsnotify
func registerDirs(w *fsnotify.Watcher, root string) {
	_ = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			base := filepath.Base(path)
			if ignoredDirs[base] {
				return filepath.SkipDir
			}
			_ = w.Add(path)
		}
		return nil
	})
}

// Lightweight TCP Socket Server on localhost:9042
func startSocketServer(port string) {
	listener, err := net.Listen("tcp", "127.0.0.1:"+port)
	if err != nil {
		log.Printf("[SOCKET WARN] Failed to bind local TCP socket on port %s: %v", port, err)
		return
	}
	defer listener.Close()

	for {
		conn, err := listener.Accept()
		if err != nil {
			continue
		}

		serverInstance.clientMux.Lock()
		serverInstance.clients[conn] = true
		serverInstance.clientMux.Unlock()

		go handleClient(conn)
	}
}

func handleClient(conn net.Conn) {
	defer func() {
		serverInstance.clientMux.Lock()
		delete(serverInstance.clients, conn)
		serverInstance.clientMux.Unlock()
		conn.Close()
	}()

	// Keep alive reader until client disconnects
	buf := make([]byte, 128)
	for {
		_, err := conn.Read(buf)
		if err != nil {
			return
		}
	}
}

func (s *Server) broadcastPayload(data []byte) {
	s.clientMux.Lock()
	defer s.clientMux.Unlock()

	msg := append(data, '\n')
	for conn := range s.clients {
		_, err := conn.Write(msg)
		if err != nil {
			conn.Close()
			delete(s.clients, conn)
		}
	}
}
