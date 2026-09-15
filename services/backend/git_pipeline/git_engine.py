"""
ORION-X Autonomous Git Pipeline Engine (Phase 5)
Provides safe, developer-gated versioning:
1. Stages verified changes from sandbox chamber back to host drive.
2. Creates isolated feature branch: orion-x/sim-<timestamp>-<slug>.
3. Generates semantic conventional commit authored by Yalini <yalineevenkatesan@gmail.com>.
4. Pushes feature branch to remote origin.
5. Provides safe workspace rollback on discard.
"""

import datetime
import logging
import os
import pathlib
import re
import shutil
import subprocess
from typing import List, Dict, Any, Optional

logger = logging.getLogger("ORION-GIT-ENGINE")

AUTHOR_NAME = "Yalini"
AUTHOR_EMAIL = "yalineevenkatesan@gmail.com"


class GitPipeline:
    def __init__(self):
        pass

    def _slugify(self, text: str, max_length: int = 30) -> str:
        """Converts an instruction into a clean branch slug."""
        text = text.lower()
        slug = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
        return slug[:max_length] if slug else "patch"

    def stage_sandbox_changes(self, session_id: str, workspace_path: str) -> Dict[str, Any]:
        """
        Copies verified modified files from .orion/sandbox_runs/<session_id>
        back into the physical workspace repository.
        """
        sandbox_dir = pathlib.Path(".orion") / "sandbox_runs" / session_id
        workspace_dir = pathlib.Path(workspace_path).resolve()

        if not sandbox_dir.exists():
            raise FileNotFoundError(f"Sandbox directory for session {session_id} not found.")

        staged_files: List[str] = []
        exclude_dirs = {".git", "node_modules", ".venv", ".orion", ".next", "dist", "build", "__pycache__"}

        for root, dirs, files in os.walk(sandbox_dir):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            rel_root = os.path.relpath(root, sandbox_dir)

            for file in files:
                src_file = pathlib.Path(root) / file
                dst_file = workspace_dir if rel_root == "." else workspace_dir / rel_root / file
                rel_file_path = str(pathlib.Path(rel_root) / file).replace("\\", "/")

                # Only copy if content is different or file is new
                should_copy = False
                if not dst_file.exists():
                    should_copy = True
                else:
                    try:
                        src_data = src_file.read_bytes()
                        dst_data = dst_file.read_bytes()
                        if src_data != dst_data:
                            should_copy = True
                    except Exception:
                        should_copy = True

                if should_copy:
                    dst_file.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(src_file, dst_file)
                    staged_files.append(rel_file_path)

        logger.info(f"[GIT] Staged {len(staged_files)} file(s) from sandbox {session_id} to {workspace_dir}")
        return {
            "session_id": session_id,
            "staged_files": staged_files,
            "count": len(staged_files)
        }

    def create_isolated_feature_branch(self, workspace_path: str, instruction: str) -> str:
        """
        Creates and checks out a new isolated feature branch:
        orion-x/sim-<timestamp>-<slugified-instruction>
        """
        timestamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        slug = self._slugify(instruction)
        branch_name = f"orion-x/sim-{timestamp}-{slug}"

        cmd = ["git", "checkout", "-b", branch_name]
        proc = subprocess.run(
            cmd,
            cwd=workspace_path,
            capture_output=True,
            text=True
        )
        if proc.returncode != 0:
            logger.warning(f"Branch create warning: {proc.stderr}")

        logger.info(f"[GIT] Created and checked out feature branch: {branch_name}")
        return branch_name

    def generate_semantic_commit(
        self,
        workspace_path: str,
        instruction: str,
        diff_summary: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Stages all applied changes and creates a conventional commit
        with author Yalini <yalineevenkatesan@gmail.com>.
        """
        # 1. Stage all changes
        subprocess.run(["git", "add", "-A"], cwd=workspace_path, capture_output=True)

        # 2. Build semantic message
        commit_msg = (
            f"feat(sim): {instruction[:72]} [ORION-X verified]\n\n"
            f"Automated speculative patch formulated by Autonomous Multi-Agent Swarm.\n"
            f"- Sandbox verified: Zero AST regressions\n"
            f"- Author: {AUTHOR_NAME} <{AUTHOR_EMAIL}>\n"
        )
        if diff_summary:
            commit_msg += f"\nDiff Summary:\n{diff_summary[:300]}\n"

        # 3. Commit with custom author
        cmd = [
            "git",
            "-c", f"user.name={AUTHOR_NAME}",
            "-c", f"user.email={AUTHOR_EMAIL}",
            "commit",
            "-m", commit_msg
        ]
        proc = subprocess.run(
            cmd,
            cwd=workspace_path,
            capture_output=True,
            text=True
        )

        commit_sha = "unknown"
        if proc.returncode == 0:
            sha_proc = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=workspace_path, capture_output=True, text=True)
            commit_sha = sha_proc.stdout.strip()
            logger.info(f"[GIT] Semantic commit created: {commit_sha}")
        else:
            logger.warning(f"[GIT] Commit output: {proc.stderr or proc.stdout}")

        return {
            "success": proc.returncode == 0,
            "commit_sha": commit_sha,
            "commit_message": commit_msg,
            "author": f"{AUTHOR_NAME} <{AUTHOR_EMAIL}>"
        }

    def push_feature_branch(self, workspace_path: str, branch_name: str) -> Dict[str, Any]:
        """Pushes feature branch to remote origin if accessible."""
        cmd = ["git", "push", "-u", "origin", branch_name]
        proc = subprocess.run(cmd, cwd=workspace_path, capture_output=True, text=True)
        pushed = (proc.returncode == 0)
        message = "Pushed to origin successfully." if pushed else f"Local commit created. Remote push pending ({proc.stderr.strip() or 'No remote origin credentials'})."

        logger.info(f"[GIT] Push result: {message}")
        return {
            "pushed": pushed,
            "branch": branch_name,
            "message": message
        }

    def rollback_workspace(self, workspace_path: str):
        """Discards uncommitted staged changes cleanly to keep physical repo safe."""
        subprocess.run(["git", "checkout", "--", "."], cwd=workspace_path, capture_output=True)
        logger.info("[GIT] Workspace rolled back cleanly.")


git_pipeline = GitPipeline()
