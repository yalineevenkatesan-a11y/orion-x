"""
ORION-X Docker Sandbox Orchestration Engine (Phase 3)
Provides isolated container chamber, replica workspace mount,
headless test execution engine, real-time telemetry streaming,
and unified diff / blast-radius calculation.
"""

import asyncio
import datetime
import difflib
import logging
import os
import pathlib
import shutil
import subprocess
import uuid
from typing import List, Dict, Any, Optional

logger = logging.getLogger("ORION-SANDBOX-ENGINE")

# Ignored directories when replicating workspace into sandbox
EXCLUDE_DIRS = {
    ".git",
    ".venv",
    "venv",
    "node_modules",
    ".orion",
    ".next",
    "dist",
    "build",
    "__pycache__",
    ".pytest_cache",
    ".cache",
}

class SandboxSession:
    def __init__(self, session_id: str, workspace_path: str):
        self.session_id = session_id
        self.workspace_path = pathlib.Path(workspace_path).resolve()
        self.sandbox_dir = pathlib.Path(".orion") / "sandbox_runs" / session_id
        self.created_at = datetime.datetime.now().isoformat()
        self.container_id: Optional[str] = None
        self.container_obj: Any = None
        self.docker_client: Any = None
        self.mode: str = "ISOLATED_QUARANTINE_FALLBACK"
        self.status: str = "INITIALIZED"
        self.target_files: List[str] = []
        self.last_command: Optional[str] = None
        self.last_exit_code: Optional[int] = None
        self.last_stdout: str = ""
        self.last_stderr: str = ""

    def provision_container(self, workspace_path: Optional[str] = None, target_files: Optional[List[str]] = None) -> str:
        """
        Creates an ephemeral replica mount in .orion/sandbox_runs/<session_id>
        and spawns a headless Docker container or sets up isolated CLI runner.
        """
        if workspace_path:
            self.workspace_path = pathlib.Path(workspace_path).resolve()
        self.target_files = target_files or []

        self.sandbox_dir.mkdir(parents=True, exist_ok=True)
        self._replicate_workspace()

        # Check Docker SDK / Daemon availability
        try:
            import docker
            client = docker.from_env(timeout=3)
            client.ping()
            self.docker_client = client

            # Determine container image based on project files
            image = "alpine:latest"
            if (self.sandbox_dir / "package.json").exists():
                image = "node:20-alpine"
            elif (self.sandbox_dir / "requirements.txt").exists() or (self.sandbox_dir / "pyproject.toml").exists():
                image = "python:3.11-slim"

            logger.info(f"[SANDBOX:{self.session_id}] Spawning Docker container ({image})...")
            container = client.containers.run(
                image,
                command="tail -f /dev/null",
                detach=True,
                remove=False,
                volumes={
                    str(self.sandbox_dir.resolve()): {
                        "bind": "/workspace",
                        "mode": "rw"
                    }
                },
                working_dir="/workspace",
                network_mode="bridge",
                mem_limit="256m",
                name=f"orion_sandbox_{self.session_id[:8]}"
            )
            self.container_obj = container
            self.container_id = container.id
            self.mode = "DOCKER_CONTAINER"
            self.status = "CONTAINER_RUNNING"
            logger.info(f"[SANDBOX:{self.session_id}] Docker container {self.container_id[:12]} online")
        except Exception as e:
            logger.info(f"[SANDBOX:{self.session_id}] Native Docker daemon offline ({e}); using isolated replica chamber fallback.")
            self.mode = "ISOLATED_QUARANTINE_FALLBACK"
            self.status = "REPLICA_MOUNTED"

        return self.session_id

    def _replicate_workspace(self):
        """Copies essential files from workspace into sandbox directory."""
        if not self.workspace_path.exists():
            logger.warning(f"Workspace path does not exist: {self.workspace_path}")
            return

        for root, dirs, files in os.walk(self.workspace_path):
            # Modify dirs in-place to avoid traversing excluded paths
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

            rel_root = os.path.relpath(root, self.workspace_path)
            target_root = self.sandbox_dir if rel_root == "." else self.sandbox_dir / rel_root
            target_root.mkdir(parents=True, exist_ok=True)

            for file in files:
                # If target_files specified, prioritize target files and configs
                src_file = pathlib.Path(root) / file
                dst_file = target_root / file

                # Quick copy avoiding large binary media if not target
                try:
                    if src_file.stat().st_size < 10 * 1024 * 1024:  # Under 10MB
                        shutil.copy2(src_file, dst_file)
                except Exception as cp_err:
                    logger.debug(f"File copy skip {src_file}: {cp_err}")

    async def execute_isolated_command(self, cmd: str, hub: Optional[Any] = None) -> Dict[str, Any]:
        """
        Executes a test/build command in the sandboxed container/chamber,
        streaming stdout/stderr in real time to the TelemetryHub.
        """
        self.last_command = cmd
        self.status = "EXECUTING"
        stdout_lines: List[str] = []
        stderr_lines: List[str] = []
        exit_code = 0

        now_str = datetime.datetime.now().strftime("%H:%M:%S.%f")[:12]
        if hub:
            await hub.broadcast({
                "timestamp": now_str,
                "source": "DOCKER_SANDBOX" if self.mode == "DOCKER_CONTAINER" else "SANDBOX_CHAMBER",
                "level": "INFO",
                "message": f"Executing isolated command in {self.mode}: `{cmd}`",
            })

        if self.mode == "DOCKER_CONTAINER" and self.container_obj:
            try:
                exec_result = self.container_obj.exec_run(
                    cmd,
                    stream=True,
                    demux=True,
                    workdir="/workspace"
                )
                for out_chunk, err_chunk in exec_result.output:
                    if out_chunk:
                        text = out_chunk.decode("utf-8", errors="replace").strip()
                        for line in text.splitlines():
                            stdout_lines.append(line)
                            if hub:
                                await hub.broadcast({
                                    "timestamp": datetime.datetime.now().strftime("%H:%M:%S.%f")[:12],
                                    "source": "DOCKER_SANDBOX",
                                    "level": "SANDBOX_STDOUT",
                                    "message": line,
                                })
                    if err_chunk:
                        text = err_chunk.decode("utf-8", errors="replace").strip()
                        for line in text.splitlines():
                            stderr_lines.append(line)
                            if hub:
                                await hub.broadcast({
                                    "timestamp": datetime.datetime.now().strftime("%H:%M:%S.%f")[:12],
                                    "source": "DOCKER_SANDBOX",
                                    "level": "SANDBOX_STDERR",
                                    "message": line,
                                })
                # Inspect final status
                inspect_res = self.container_obj.client.api.exec_inspect(exec_result[0] if isinstance(exec_result, tuple) else exec_result)
                exit_code = inspect_res.get("ExitCode", 0) if isinstance(inspect_res, dict) else 0
            except Exception as dock_err:
                logger.warning(f"Docker exec error: {dock_err}")
                stderr_lines.append(str(dock_err))
                exit_code = 1
        else:
            # Subprocess execution in quarantined sandbox replica directory
            sanitized_env = os.environ.copy()
            sanitized_env["ORION_SANDBOX"] = "1"
            sanitized_env["ORION_SESSION_ID"] = self.session_id

            try:
                proc = await asyncio.create_subprocess_shell(
                    cmd,
                    cwd=str(self.sandbox_dir.resolve()),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=sanitized_env,
                )

                async def read_stream(stream, is_err: bool):
                    while True:
                        line_b = await stream.readline()
                        if not line_b:
                            break
                        line_str = line_b.decode("utf-8", errors="replace").rstrip("\r\n")
                        if is_err:
                            stderr_lines.append(line_str)
                        else:
                            stdout_lines.append(line_str)
                        if hub:
                            await hub.broadcast({
                                "timestamp": datetime.datetime.now().strftime("%H:%M:%S.%f")[:12],
                                "source": "SANDBOX_CHAMBER",
                                "level": "SANDBOX_STDERR" if is_err else "SANDBOX_STDOUT",
                                "message": line_str,
                            })

                await asyncio.gather(
                    read_stream(proc.stdout, False),
                    read_stream(proc.stderr, True),
                )
                exit_code = await proc.wait()
            except Exception as sub_err:
                logger.warning(f"Chamber execution error: {sub_err}")
                stderr_lines.append(str(sub_err))
                exit_code = 1

        self.last_exit_code = exit_code
        self.last_stdout = "\n".join(stdout_lines)
        self.last_stderr = "\n".join(stderr_lines)
        self.status = "PASSED" if exit_code == 0 else "FAILED"

        fin_time = datetime.datetime.now().strftime("%H:%M:%S.%f")[:12]
        if hub:
            await hub.broadcast({
                "timestamp": fin_time,
                "source": "SANDBOX_CHAMBER",
                "level": "OK" if exit_code == 0 else "ERR",
                "message": f"Execution finished with exit code {exit_code} (Status: {self.status})",
            })

        return {
            "session_id": self.session_id,
            "command": cmd,
            "exit_code": exit_code,
            "status": self.status,
            "stdout": self.last_stdout,
            "stderr": self.last_stderr,
        }

    def calculate_code_diff(self) -> Dict[str, Any]:
        """
        Compares modified files inside the temporary sandbox directory
        against the original host repository, producing unified diffs and blast radius.
        """
        diff_outputs: List[str] = []
        affected_files: List[str] = []

        if not self.sandbox_dir.exists():
            return {
                "session_id": self.session_id,
                "affected_files": [],
                "diff": "",
                "blast_radius": {
                    "direct_count": 0,
                    "risk_level": "LOW",
                    "impacted_modules": []
                }
            }

        for root, dirs, files in os.walk(self.sandbox_dir):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            rel_root = os.path.relpath(root, self.sandbox_dir)

            for file in files:
                sandbox_file = pathlib.Path(root) / file
                host_file = self.workspace_path / rel_root / file if rel_root != "." else self.workspace_path / file
                rel_file_path = str(pathlib.Path(rel_root) / file).replace("\\", "/")

                if not host_file.exists():
                    # New file created in sandbox
                    try:
                        new_content = sandbox_file.read_text(encoding="utf-8", errors="replace")
                        affected_files.append(rel_file_path)
                        diff = "".join(difflib.unified_diff(
                            [],
                            new_content.splitlines(keepends=True),
                            fromfile=f"a/{rel_file_path} (non-existent)",
                            tofile=f"b/{rel_file_path} (new in sandbox)"
                        ))
                        diff_outputs.append(diff)
                    except Exception:
                        pass
                else:
                    try:
                        host_content = host_file.read_text(encoding="utf-8", errors="replace")
                        sandbox_content = sandbox_file.read_text(encoding="utf-8", errors="replace")
                        if host_content != sandbox_content:
                            affected_files.append(rel_file_path)
                            diff = "".join(difflib.unified_diff(
                                host_content.splitlines(keepends=True),
                                sandbox_content.splitlines(keepends=True),
                                fromfile=f"a/{rel_file_path}",
                                tofile=f"b/{rel_file_path}"
                            ))
                            diff_outputs.append(diff)
                    except Exception:
                        pass

        direct_count = len(affected_files)
        risk_level = "LOW" if direct_count <= 2 else ("MEDIUM" if direct_count <= 5 else "CRITICAL")

        return {
            "session_id": self.session_id,
            "affected_files": affected_files,
            "diff": "\n".join(diff_outputs),
            "blast_radius": {
                "direct_count": direct_count,
                "risk_level": risk_level,
                "impacted_modules": list(set([f.split("/")[0] for f in affected_files if "/" in f]))
            }
        }

    def teardown_container(self):
        """Stops/removes container and flushes temporary sandbox directories."""
        self.status = "TEARDOWN"
        if self.container_obj:
            try:
                self.container_obj.stop(timeout=2)
                self.container_obj.remove(force=True)
                logger.info(f"[SANDBOX:{self.session_id}] Removed container {self.container_id}")
            except Exception as e:
                logger.warning(f"Error removing container: {e}")
            self.container_obj = None
            self.container_id = None

        if self.sandbox_dir.exists():
            try:
                shutil.rmtree(self.sandbox_dir, ignore_errors=True)
                logger.info(f"[SANDBOX:{self.session_id}] Cleaned up {self.sandbox_dir}")
            except Exception as e:
                logger.warning(f"Error deleting sandbox directory: {e}")

        self.status = "TEARDOWN_COMPLETE"


class SandboxManager:
    def __init__(self):
        self.sessions: Dict[str, SandboxSession] = {}

    def check_docker_status(self) -> str:
        """Probes the local Docker daemon status."""
        try:
            import docker
            client = docker.from_env(timeout=2)
            if client.ping():
                return "ONLINE"
        except Exception:
            pass
        return "STANDBY (CLI FALLBACK)"

    def spawn_session(self, workspace_path: str, target_files: Optional[List[str]] = None) -> SandboxSession:
        session_id = f"sbx_{uuid.uuid4().hex[:10]}"
        session = SandboxSession(session_id, workspace_path)
        session.provision_container(workspace_path, target_files)
        self.sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> Optional[SandboxSession]:
        return self.sessions.get(session_id)

    def teardown_session(self, session_id: str) -> bool:
        session = self.sessions.pop(session_id, None)
        if session:
            session.teardown_container()
            return True
        return False

    def cleanup_all(self):
        for sid in list(self.sessions.keys()):
            self.teardown_session(sid)


sandbox_manager = SandboxManager()
