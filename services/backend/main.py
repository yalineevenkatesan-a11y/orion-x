"""
ORION-X Core Kernel Backend Service (Phase 2)
Provides live WebSocket streaming on /ws/logs (localhost:8000),
FAISS vector retrieval engine caching to .orion/vector.index,
and connects to Go AST Watcher at localhost:9042/ws/ast.
"""

import asyncio
import datetime
import json
import logging
import os
import pathlib
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from services.backend.sandbox.docker_engine import sandbox_manager
except ImportError:
    from sandbox.docker_engine import sandbox_manager

try:
    from services.backend.agents.swarm_kernel import swarm_kernel
except ImportError:
    from agents.swarm_kernel import swarm_kernel

try:
    from services.backend.storage.db_manager import db_manager
except ImportError:
    from storage.db_manager import db_manager

try:
    from services.backend.git_pipeline.git_engine import git_pipeline
except ImportError:
    from git_pipeline.git_engine import git_pipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ORION-CORE-BACKEND")

CACHE_DIR = pathlib.Path(".orion")
CACHE_DIR.mkdir(parents=True, exist_ok=True)
INDEX_FILE = CACHE_DIR / "vector.index"

# --------------------------------------------------------------------------
# Live Telemetry Hub
# --------------------------------------------------------------------------
class TelemetryHub:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"[WS] Client connected. Total active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"[WS] Client disconnected. Total active: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        if not self.active_connections:
            return
        payload = json.dumps(message)
        dead = []
        for conn in self.active_connections:
            try:
                await conn.send_text(payload)
            except Exception:
                dead.append(conn)
        for conn in dead:
            self.disconnect(conn)


hub = TelemetryHub()

# --------------------------------------------------------------------------
# FAISS Vector Retrieval Engine
# --------------------------------------------------------------------------
class VectorService:
    def __init__(self):
        self.dimension = 384  # all-MiniLM-L6-v2 embedding dimension
        self.index = None
        self.model = None
        self.documents: Dict[int, Dict[str, Any]] = {}
        self.next_id = 0
        self.is_faiss_loaded = False
        self._init_engine()

    def _init_engine(self):
        try:
            import faiss
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer("all-MiniLM-L6-v2")
            if INDEX_FILE.exists():
                try:
                    self.index = faiss.read_index(str(INDEX_FILE))
                    self.is_faiss_loaded = True
                    logger.info(f"[FAISS] Loaded cached vector index from {INDEX_FILE}")
                except Exception as load_err:
                    logger.warning(f"[FAISS] Failed to read cached index: {load_err}")
            if self.index is None:
                self.index = faiss.IndexFlatIP(self.dimension)
                self.is_faiss_loaded = True
                logger.info("[FAISS] Initialized fresh Faiss IndexFlatIP (384-D)")
        except ImportError:
            logger.info("[FAISS] sentence-transformers / faiss-cpu not installed in environment; using lightweight lexical fallback.")
            self.is_faiss_loaded = False

    def add_document(self, text: str, metadata: Dict[str, Any]) -> int:
        doc_id = self.next_id
        self.next_id += 1
        self.documents[doc_id] = {"text": text, "metadata": metadata}

        if self.is_faiss_loaded and self.model is not None and self.index is not None:
            try:
                import numpy as np
                import faiss
                embedding = self.model.encode([text])
                faiss.normalize_L2(embedding)
                self.index.add(embedding.astype(np.float32))
                faiss.write_index(self.index, str(INDEX_FILE))
            except Exception as e:
                logger.warning(f"[FAISS INDEX ERROR] {e}")

        return doc_id

    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        results = []
        if self.is_faiss_loaded and self.model is not None and self.index is not None and self.index.ntotal > 0:
            try:
                import numpy as np
                import faiss
                query_vec = self.model.encode([query])
                faiss.normalize_L2(query_vec)
                distances, indices = self.index.search(query_vec.astype(np.float32), min(top_k, self.index.ntotal))
                for dist, idx in zip(distances[0], indices[0]):
                    if idx in self.documents:
                        results.append({
                            "id": int(idx),
                            "score": float(dist),
                            "text": self.documents[idx]["text"],
                            "metadata": self.documents[idx]["metadata"],
                        })
                return results
            except Exception as e:
                logger.warning(f"[FAISS SEARCH ERROR] {e}")

        # Lexical fallback matching
        q_tokens = query.lower().split()
        for d_id, doc in self.documents.items():
            content = doc["text"].lower()
            score = sum(1.0 for t in q_tokens if t in content)
            if score > 0:
                results.append({
                    "id": d_id,
                    "score": score,
                    "text": doc["text"],
                    "metadata": doc["metadata"]
                })
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]


vector_service = VectorService()

# --------------------------------------------------------------------------
# Background Listener for Go AST Watcher (ws://127.0.0.1:9042/ws/ast)
# --------------------------------------------------------------------------
async def bridge_go_ast_watcher():
    """Connects to Go AST Watcher WebSocket on port 9042 and relays events to telemetry stream"""
    import websockets
    while True:
        try:
            async with websockets.connect("ws://127.0.0.1:9042/ws/ast") as ws:
                logger.info("[GO BRIDGE] Connected to Go AST Watcher on ws://127.0.0.1:9042/ws/ast")
                await hub.broadcast({
                    "timestamp": datetime.datetime.now().strftime("%H:%M:%S.%f")[:12],
                    "source": "GO_AST",
                    "level": "OK",
                    "message": "Connected to Go AST Watcher daemon on localhost:9042/ws/ast",
                })
                while True:
                    msg = await ws.recv()
                    data = json.loads(msg)
                    file_path = data.get("file_path", "unknown")
                    imports_count = len(data.get("imports", []))
                    loc = data.get("loc", 0)
                    now_str = datetime.datetime.now().strftime("%H:%M:%S.%f")[:12]
                    await hub.broadcast({
                        "timestamp": now_str,
                        "source": "GO_AST",
                        "level": "INFO",
                        "message": f"Parsed {file_path} ({loc} LOC, {imports_count} imports)",
                    })
        except Exception:
            # Go daemon offline or reconnecting
            await asyncio.sleep(4)


# --------------------------------------------------------------------------
# Lifecycle & Application Setup
# --------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    watcher_task = asyncio.create_task(bridge_go_ast_watcher())
    logger.info("[KERNEL] ORION-X Core Kernel Backend ready on 127.0.0.1:8000")
    yield
    sandbox_manager.cleanup_all()
    watcher_task.cancel()


app = FastAPI(title="ORION-X Core Kernel", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------------------
# API Routes
# --------------------------------------------------------------------------
@app.websocket("/ws/logs")
async def websocket_logs_endpoint(websocket: WebSocket):
    await hub.connect(websocket)
    try:
        now_str = datetime.datetime.now().strftime("%H:%M:%S.%f")[:12]
        await hub.broadcast({
            "timestamp": now_str,
            "source": "ORION_KERNEL",
            "level": "OK",
            "message": "Telemetry socket established. Connected to host daemon.",
        })
        while True:
            data = await websocket.receive_text()
            now_str = datetime.datetime.now().strftime("%H:%M:%S.%f")[:12]
            try:
                parsed = json.loads(data)
                await hub.broadcast({
                    "timestamp": now_str,
                    "source": parsed.get("source", "CLIENT"),
                    "level": parsed.get("level", "INFO"),
                    "message": parsed.get("message", data),
                })
            except Exception:
                await hub.broadcast({
                    "timestamp": now_str,
                    "source": "CLIENT",
                    "level": "INFO",
                    "message": f"Instruction staged: {data}",
                })
    except WebSocketDisconnect:
        hub.disconnect(websocket)
    except Exception as e:
        logger.warning(f"[WS DISCONNECT ERROR] {e}")
        hub.disconnect(websocket)


@app.get("/api/v1/health")
async def health_check():
    docker_status = sandbox_manager.check_docker_status()
    swarm_status = "READY (GEMINI-1.5)" if swarm_kernel.is_gemini_active() else "READY"
    return {
        "status": "ONLINE",
        "go_ast_service": "LISTENING_9042",
        "faiss_index": "READY",
        "docker_chamber": docker_status,
        "swarm_engine": swarm_status,
        "persistence_tier": "ONLINE",
        "git_pipeline": "READY",
        "active_telemetry_clients": len(hub.active_connections),
        "active_sandbox_sessions": len(sandbox_manager.sessions),
    }


# --------------------------------------------------------------------------
# Docker Sandbox Endpoints (Phase 3)
# --------------------------------------------------------------------------
class SpawnPayload(BaseModel):
    workspace_path: Optional[str] = None
    target_files: Optional[List[str]] = None


class ExecutePayload(BaseModel):
    session_id: str
    command: str


@app.post("/api/v1/sandbox/spawn")
async def spawn_sandbox(payload: SpawnPayload):
    ws_path = payload.workspace_path or os.getcwd()
    session = sandbox_manager.spawn_session(ws_path, payload.target_files)
    now_str = datetime.datetime.now().strftime("%H:%M:%S.%f")[:12]
    await hub.broadcast({
        "timestamp": now_str,
        "source": "ORION_KERNEL",
        "level": "OK",
        "message": f"Docker quarantine chamber spawned: {session.session_id} (Mode: {session.mode})",
    })
    return {
        "status": "PROVISIONED",
        "session_id": session.session_id,
        "mode": session.mode,
        "sandbox_path": str(session.sandbox_dir),
        "created_at": session.created_at,
    }


@app.post("/api/v1/sandbox/execute")
async def execute_sandbox(payload: ExecutePayload):
    session = sandbox_manager.get_session(payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Sandbox session {payload.session_id} not found")
    res = await session.execute_isolated_command(payload.command, hub=hub)
    return res


@app.get("/api/v1/sandbox/diff/{session_id}")
async def get_sandbox_diff(session_id: str):
    session = sandbox_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Sandbox session {session_id} not found")
    diff_info = session.calculate_code_diff()
    return {
        "session_id": session_id,
        "status": session.status,
        "exit_code": session.last_exit_code,
        "diff": diff_info["diff"],
        "affected_files": diff_info["affected_files"],
        "blast_radius": diff_info["blast_radius"],
    }


@app.post("/api/v1/sandbox/teardown/{session_id}")
async def teardown_sandbox(session_id: str):
    success = sandbox_manager.teardown_session(session_id)
    now_str = datetime.datetime.now().strftime("%H:%M:%S.%f")[:12]
    await hub.broadcast({
        "timestamp": now_str,
        "source": "ORION_KERNEL",
        "level": "INFO",
        "message": f"Sandbox session {session_id} flushed and torn down.",
    })
    return {"status": "TEARDOWN_COMPLETE", "session_id": session_id, "success": success}


# --------------------------------------------------------------------------
# Multi-Agent Swarm Endpoints (Phase 4)
# --------------------------------------------------------------------------
class SwarmSimulatePayload(BaseModel):
    workspace_path: Optional[str] = None
    instruction: str
    target_files: Optional[List[str]] = None
    max_retries: Optional[int] = 3


@app.post("/api/v1/swarm/simulate")
async def simulate_swarm(payload: SwarmSimulatePayload):
    ws_path = payload.workspace_path or os.getcwd()
    result = await swarm_kernel.run_swarm_simulation(
        instruction=payload.instruction,
        workspace_path=ws_path,
        target_files=payload.target_files,
        hub=hub,
        vector_service=vector_service,
        max_retries=payload.max_retries or 3
    )

    # Persist simulation run and full trace
    try:
        db_manager.record_simulation_run(
            session_id=result["session_id"],
            instruction=payload.instruction,
            status=result["status"],
            iterations=result.get("iterations", 1),
            blast_risk_level=result.get("blast_radius", {}).get("risk_level", "LOW")
        )
        db_manager.save_trace(
            session_id=result["session_id"],
            trace_data={
                "instruction": payload.instruction,
                "status": result["status"],
                "iterations": result.get("iterations", 1),
                "diff": result.get("diff", ""),
                "affected_files": result.get("affected_files", []),
                "blast_radius": result.get("blast_radius", {}),
            }
        )
    except Exception as db_err:
        logger.warning(f"Failed to record run in persistence tier: {db_err}")

    return result


# --------------------------------------------------------------------------
# Persistence Tier & Authentication Endpoints (Phase 5)
# --------------------------------------------------------------------------
class GoogleSyncPayload(BaseModel):
    email: str
    google_oauth_sub: str
    name: Optional[str] = None


@app.post("/api/v1/auth/google-sync")
async def google_auth_sync(payload: GoogleSyncPayload):
    res = db_manager.sync_google_user(payload.email, payload.google_oauth_sub, payload.name)
    return res


@app.get("/api/v1/history/runs")
async def get_history_runs(limit: int = 20, offset: int = 0):
    runs = db_manager.get_history_runs(limit, offset)
    return {"runs": runs, "count": len(runs), "limit": limit, "offset": offset}


@app.get("/api/v1/history/trace/{session_id}")
async def get_simulation_trace(session_id: str):
    trace = db_manager.get_trace(session_id)
    if not trace:
        raise HTTPException(status_code=404, detail=f"Trace for session {session_id} not found")
    return trace


# --------------------------------------------------------------------------
# Autonomous Git Pipeline Endpoints (Phase 5)
# --------------------------------------------------------------------------
class GitApplyPayload(BaseModel):
    session_id: str
    workspace_path: Optional[str] = None
    instruction: str
    auto_push: Optional[bool] = False


@app.post("/api/v1/git/apply")
async def git_apply_changes(payload: GitApplyPayload):
    ws_path = payload.workspace_path or os.getcwd()
    stage_res = git_pipeline.stage_sandbox_changes(payload.session_id, ws_path)
    branch_name = git_pipeline.create_isolated_feature_branch(ws_path, payload.instruction)
    commit_res = git_pipeline.generate_semantic_commit(ws_path, payload.instruction)

    push_res = {"pushed": False, "message": "Auto-push disabled."}
    if payload.auto_push:
        push_res = git_pipeline.push_feature_branch(ws_path, branch_name)

    # Record updated status in relational store
    try:
        db_manager.record_simulation_run(
            session_id=payload.session_id,
            instruction=payload.instruction,
            status="APPLIED_COMMITTED",
            iterations=1,
            blast_risk_level="LOW"
        )
    except Exception:
        pass

    now_str = datetime.datetime.now().strftime("%H:%M:%S.%f")[:12]
    await hub.broadcast({
        "timestamp": now_str,
        "source": "GIT_PIPELINE",
        "level": "OK",
        "message": f"Changes applied to branch `{branch_name}`. Commit: {commit_res.get('commit_sha')}. Author: Yalini.",
    })

    return {
        "status": "APPLIED",
        "branch": branch_name,
        "commit": commit_res,
        "push": push_res,
        "staged_files": stage_res["staged_files"]
    }


class GitDiscardPayload(BaseModel):
    session_id: str
    workspace_path: Optional[str] = None


@app.post("/api/v1/git/discard")
async def git_discard_changes(payload: GitDiscardPayload):
    ws_path = payload.workspace_path or os.getcwd()
    git_pipeline.rollback_workspace(ws_path)
    sandbox_manager.teardown_session(payload.session_id)

    now_str = datetime.datetime.now().strftime("%H:%M:%S.%f")[:12]
    await hub.broadcast({
        "timestamp": now_str,
        "source": "GIT_PIPELINE",
        "level": "INFO",
        "message": f"Simulation changes for session {payload.session_id} discarded. Workspace untouched.",
    })
    return {"status": "DISCARDED", "session_id": payload.session_id}


class DocumentPayload(BaseModel):
    text: str
    metadata: Optional[Dict[str, Any]] = None


class SearchQuery(BaseModel):
    query: str
    top_k: int = 5


@app.post("/api/v1/vector/index")
async def index_document(doc: DocumentPayload):
    doc_id = vector_service.add_document(doc.text, doc.metadata or {})
    return {"status": "INDEXED", "doc_id": doc_id}


@app.post("/api/v1/vector/query")
async def query_documents(sq: SearchQuery):
    results = vector_service.search(sq.query, sq.top_k)
    return {"query": sq.query, "results": results}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
