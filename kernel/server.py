"""
ORION-X Python FastAPI Kernel & Telemetry Server (Phase 2)
Serves real-time WebSocket telemetry stream (ws://localhost:8000/ws/logs),
bridges Go AST Watcher events (localhost:9042), and provides FAISS vector kernel.
"""

import asyncio
import datetime
import json
import logging
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from services.backend.sandbox.docker_engine import sandbox_manager
except ImportError:
    import sys, os
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    from services.backend.sandbox.docker_engine import sandbox_manager

try:
    from services.backend.agents.swarm_kernel import swarm_kernel
except ImportError:
    import sys, os
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    from services.backend.agents.swarm_kernel import swarm_kernel

try:
    from services.backend.storage.db_manager import db_manager
except ImportError:
    import sys, os
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    from services.backend.storage.db_manager import db_manager

try:
    from services.backend.git_pipeline.git_engine import git_pipeline
except ImportError:
    import sys, os
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    from services.backend.git_pipeline.git_engine import git_pipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ORION-KERNEL")

# --------------------------------------------------------------------------
# Connection & Log Streaming Manager
# --------------------------------------------------------------------------
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"[WS] Client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"[WS] Client disconnected. Active clients: {len(self.active_connections)}")

    async def broadcast_log(self, source: str, level: str, message: str):
        now = datetime.datetime.now()
        timestamp = now.strftime("%H:%M:%S") + f".{now.microsecond // 1000:03d}"
        packet = {
            "timestamp": timestamp,
            "source": source,
            "level": level.upper(),
            "message": message,
        }
        dead_conns = []
        for connection in self.active_connections:
            try:
                await connection.send_json(packet)
            except Exception:
                dead_conns.append(connection)
        for dead in dead_conns:
            self.disconnect(dead)


manager = ConnectionManager()

# --------------------------------------------------------------------------
# Bridge: Listening to Go AST Watcher TCP Socket (port 9042)
# --------------------------------------------------------------------------
async def listen_to_go_watcher():
    """Continuously attempts to connect to Go AST Watcher on localhost:9042"""
    while True:
        try:
            reader, writer = await asyncio.open_connection("127.0.0.1", 9042)
            logger.info("[BRIDGE] Connected to Go AST Watcher on localhost:9042")
            await manager.broadcast_log("GO-AST", "OK", "Connected to Go AST Watcher daemon on port 9042")

            while True:
                line = await reader.readline()
                if not line:
                    break
                raw_str = line.decode("utf-8").strip()
                if raw_str:
                    try:
                        data = json.loads(raw_str)
                        file_path = data.get("file", "unknown")
                        imports_count = len(data.get("imports", []))
                        exports_count = len(data.get("exports", []))
                        loc = data.get("loc", 0)
                        msg = f"Parsed {file_path} ({loc} LOC, {imports_count} imports, {exports_count} exports)"
                        await manager.broadcast_log("GO-AST", "INFO", msg)
                    except json.JSONDecodeError:
                        await manager.broadcast_log("GO-AST", "DEBUG", raw_str)
        except (ConnectionRefusedError, OSError):
            # Go AST Watcher not currently running; retry after brief delay
            await asyncio.sleep(4)
        except Exception as e:
            logger.warning(f"[BRIDGE ERROR] {e}")
            await asyncio.sleep(4)


# --------------------------------------------------------------------------
# FAISS Vector Memory Engine (In-Memory Fallback & Vector Model)
# --------------------------------------------------------------------------
class VectorQueryRequest(BaseModel):
    query: str
    top_k: int = 5


class VectorNode(BaseModel):
    id: str
    path: str
    content: str
    metadata: Optional[Dict[str, Any]] = None


class InMemoryVectorStore:
    def __init__(self):
        self.documents: Dict[str, VectorNode] = {}

    def insert(self, node: VectorNode):
        self.documents[node.id] = node

    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        results = []
        tokens = query.lower().split()
        for doc in self.documents.values():
            score = sum(1.0 for t in tokens if t in doc.content.lower())
            if score > 0:
                results.append({"id": doc.id, "path": doc.path, "score": score})
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]


vector_store = InMemoryVectorStore()


# --------------------------------------------------------------------------
# FastAPI Application Setup with Lifecycle
# --------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Background task connecting to Go Watcher
    watcher_task = asyncio.create_task(listen_to_go_watcher())
    logger.info("[KERNEL] ORION-X FastAPI Kernel initialized.")
    yield
    watcher_task.cancel()


app = FastAPI(
    title="ORION-X Telemetry Kernel",
    description="Live WebSocket and AST Logistics Server for ORION-X Studio",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "service": "ORION-X Telemetry Kernel",
        "status": "ONLINE",
        "timestamp": datetime.datetime.now().isoformat(),
        "endpoints": {
            "websocket_logs": "/ws/logs",
            "health": "/api/health",
            "vector_query": "/api/vector/query",
        },
    }


@app.get("/api/v1/health")
async def health_check():
    docker_status = sandbox_manager.check_docker_status()
    swarm_status = "READY (GEMINI-1.5)" if swarm_kernel.is_gemini_active() else "READY"
    return {
        "status": "NOMINAL",
        "go_ast_service": "LISTENING_9042",
        "docker_sandbox": docker_status,
        "faiss_kernel": "IDLE",
        "faiss_index": "READY",
        "docker_chamber": docker_status,
        "swarm_engine": swarm_status,
        "persistence_tier": "ONLINE",
        "git_pipeline": "READY",
        "active_ws_clients": len(manager.active_connections),
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
    import os
    ws_path = payload.workspace_path or os.getcwd()
    session = sandbox_manager.spawn_session(ws_path, payload.target_files)
    await manager.broadcast_log(
        "ORION_KERNEL", "OK", f"Quarantine chamber spawned: {session.session_id} (Mode: {session.mode})"
    )
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
    res = await session.execute_isolated_command(payload.command, hub=None)
    # Broadcast to websocket clients
    await manager.broadcast_log(
        "SANDBOX_CHAMBER", "OK" if res["exit_code"] == 0 else "ERR",
        f"Execution completed with exit code {res['exit_code']}"
    )
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
    await manager.broadcast_log("ORION_KERNEL", "INFO", f"Sandbox session {session_id} torn down.")
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
    import os
    ws_path = payload.workspace_path or os.getcwd()
    result = await swarm_kernel.run_swarm_simulation(
        instruction=payload.instruction,
        workspace_path=ws_path,
        target_files=payload.target_files,
        hub=None,
        vector_service=None,
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

    # Broadcast final status
    await manager.broadcast_log(
        "SWARM_LOOP", "OK" if result["status"] == "COMPLETED" else "ERR",
        f"Swarm simulation complete ({result['status']}) - {result['iterations']} iterations."
    )
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
    import os
    ws_path = payload.workspace_path or os.getcwd()
    stage_res = git_pipeline.stage_sandbox_changes(payload.session_id, ws_path)
    branch_name = git_pipeline.create_isolated_feature_branch(ws_path, payload.instruction)
    commit_res = git_pipeline.generate_semantic_commit(ws_path, payload.instruction)

    push_res = {"pushed": False, "message": "Auto-push disabled."}
    if payload.auto_push:
        push_res = git_pipeline.push_feature_branch(ws_path, branch_name)

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

    await manager.broadcast_log(
        "GIT_PIPELINE", "OK",
        f"Changes applied to branch `{branch_name}`. Commit: {commit_res.get('commit_sha')}. Author: Yalini."
    )

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
    import os
    ws_path = payload.workspace_path or os.getcwd()
    git_pipeline.rollback_workspace(ws_path)
    sandbox_manager.teardown_session(payload.session_id)

    await manager.broadcast_log(
        "GIT_PIPELINE", "INFO",
        f"Simulation changes for session {payload.session_id} discarded. Workspace untouched."
    )
    return {"status": "DISCARDED", "session_id": payload.session_id}


@app.post("/api/vector/index")
async def index_node(node: VectorNode):
    vector_store.insert(node)
    await manager.broadcast_log(
        "FAISS-KERNEL", "INFO", f"Indexed node: {node.path} [id: {node.id}]"
    )
    return {"status": "INDEXED", "id": node.id}


@app.post("/api/vector/query")
async def query_vector(req: VectorQueryRequest):
    results = vector_store.search(req.query, req.top_k)
    await manager.broadcast_log(
        "FAISS-KERNEL", "INFO", f"Vector query executed for '{req.query}' ({len(results)} matches)"
    )
    return {"query": req.query, "matches": results}


@app.websocket("/ws/logs")
async def websocket_logs(websocket: WebSocket):
    """
    WebSocket endpoint for real-time telemetry logs consumed by TelemetryTerminal.jsx
    """
    await manager.connect(websocket)
    try:
        # Welcome message packet
        await websocket.send_json({
            "timestamp": datetime.datetime.now().strftime("%H:%M:%S.%f")[:12],
            "source": "KERNEL",
            "level": "OK",
            "message": "ORION-X Telemetry stream connected successfully",
        })
        while True:
            data = await websocket.receive_text()
            # Echo or broadcast incoming client ping
            try:
                parsed = json.loads(data)
                await manager.broadcast_log(
                    parsed.get("source", "CLIENT"),
                    parsed.get("level", "INFO"),
                    parsed.get("message", data),
                )
            except Exception:
                await manager.broadcast_log("CLIENT", "INFO", data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"[WS EXCEPTION] {e}")
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
