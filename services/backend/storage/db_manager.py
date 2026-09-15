"""
ORION-X Dual-Database Persistence Tier (Phase 5)
Provides hybrid storage:
1. PostgreSQL / SQLite relational store for user profiles, projects, and simulation run metadata.
2. MongoDB / JSON trace store for unstructured multi-agent dialogue traces, AST trees, and diff snapshots.
"""

import datetime
import hashlib
import json
import logging
import os
import pathlib
import uuid
from typing import List, Dict, Any, Optional

from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, desc
from sqlalchemy.orm import declarative_base, sessionmaker, scoped_session

logger = logging.getLogger("ORION-STORAGE-MGR")

BASE_ORION_DIR = pathlib.Path(".orion")
BASE_ORION_DIR.mkdir(parents=True, exist_ok=True)
TRACES_DIR = BASE_ORION_DIR / "traces"
TRACES_DIR.mkdir(parents=True, exist_ok=True)

Base = declarative_base()


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    google_oauth_sub = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    api_token_hash = Column(String(255), nullable=True)


class WorkspaceProject(Base):
    __tablename__ = "workspace_projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_name = Column(String(255), nullable=False)
    root_path = Column(String(1024), nullable=False)
    last_scanned_at = Column(DateTime, default=datetime.datetime.utcnow)
    blast_risk_level = Column(String(50), default="LOW")


class SimulationRun(Base):
    __tablename__ = "simulation_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(128), unique=True, nullable=False, index=True)
    instruction = Column(Text, nullable=False)
    status = Column(String(50), nullable=False)  # COMPLETED, FAILED, RUNNING
    iterations = Column(Integer, default=1)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    blast_risk_level = Column(String(50), default="LOW")


class DBManager:
    def __init__(self):
        self.db_url = os.environ.get("DATABASE_URL", "").strip()
        self.mongo_uri = os.environ.get("MONGODB_URI", "").strip()
        self.is_postgres = bool(self.db_url.startswith("postgresql"))
        self.is_mongo = bool(self.mongo_uri.startswith("mongodb"))

        # 1. Relational Engine (PostgreSQL or SQLite fallback)
        if not self.db_url:
            sqlite_path = BASE_ORION_DIR / "meta.db"
            self.db_url = f"sqlite:///{sqlite_path.resolve()}"
            logger.info(f"[PERSISTENCE] Using SQLite metadata database at {sqlite_path}")
        else:
            logger.info("[PERSISTENCE] Using PostgreSQL database cluster")

        self.engine = create_engine(
            self.db_url,
            connect_args={"check_same_thread": False} if "sqlite" in self.db_url else {}
        )
        Base.metadata.create_all(self.engine)
        self.SessionLocal = scoped_session(sessionmaker(bind=self.engine))

        # 2. Document Trace Store (MongoDB or JSON Document Fallback)
        self.mongo_client = None
        if self.is_mongo:
            try:
                import pymongo
                self.mongo_client = pymongo.MongoClient(self.mongo_uri, serverSelectionTimeoutMS=2000)
                self.mongo_client.server_info()
                logger.info("[PERSISTENCE] Connected to MongoDB trace store cluster")
            except Exception as e:
                logger.warning(f"[PERSISTENCE] MongoDB connection failed: {e}. Using JSON trace fallback.")
                self.mongo_client = None
        else:
            logger.info("[PERSISTENCE] Using JSON-document trace store at .orion/traces/")

    # --------------------------------------------------------------------------
    # Relational Store Operations
    # --------------------------------------------------------------------------
    def sync_google_user(self, email: str, google_oauth_sub: str, name: Optional[str] = None) -> Dict[str, Any]:
        """Validates or provisions user profile and produces an active session token."""
        session = self.SessionLocal()
        try:
            user = session.query(UserProfile).filter(UserProfile.email == email).first()
            token_raw = f"{email}:{google_oauth_sub}:{datetime.datetime.utcnow().isoformat()}"
            token_hash = hashlib.sha256(token_raw.encode("utf-8")).hexdigest()

            if not user:
                user = UserProfile(
                    email=email,
                    google_oauth_sub=google_oauth_sub,
                    created_at=datetime.datetime.utcnow(),
                    api_token_hash=token_hash
                )
                session.add(user)
            else:
                user.google_oauth_sub = google_oauth_sub
                user.api_token_hash = token_hash

            session.commit()
            return {
                "user_id": user.id,
                "email": user.email,
                "token": f"orion_jwt_{token_hash[:32]}",
                "synced_at": datetime.datetime.utcnow().isoformat(),
            }
        finally:
            session.close()

    def record_simulation_run(
        self,
        session_id: str,
        instruction: str,
        status: str,
        iterations: int = 1,
        blast_risk_level: str = "LOW"
    ) -> Dict[str, Any]:
        """Saves or updates a simulation run record in the relational store."""
        session = self.SessionLocal()
        try:
            run = session.query(SimulationRun).filter(SimulationRun.session_id == session_id).first()
            if not run:
                run = SimulationRun(
                    session_id=session_id,
                    instruction=instruction,
                    status=status,
                    iterations=iterations,
                    timestamp=datetime.datetime.utcnow(),
                    blast_risk_level=blast_risk_level
                )
                session.add(run)
            else:
                run.status = status
                run.iterations = iterations
                run.blast_risk_level = blast_risk_level

            session.commit()
            return {
                "id": run.id,
                "session_id": run.session_id,
                "instruction": run.instruction,
                "status": run.status,
                "iterations": run.iterations,
                "blast_risk_level": run.blast_risk_level,
                "timestamp": run.timestamp.isoformat(),
            }
        finally:
            session.close()

    def get_history_runs(self, limit: int = 20, offset: int = 0) -> List[Dict[str, Any]]:
        """Returns paginated list of past simulation runs."""
        session = self.SessionLocal()
        try:
            runs = (
                session.query(SimulationRun)
                .order_by(desc(SimulationRun.timestamp))
                .offset(offset)
                .limit(limit)
                .all()
            )
            return [
                {
                    "id": r.id,
                    "session_id": r.session_id,
                    "instruction": r.instruction,
                    "status": r.status,
                    "iterations": r.iterations,
                    "blast_risk_level": r.blast_risk_level,
                    "timestamp": r.timestamp.isoformat(),
                }
                for r in runs
            ]
        finally:
            session.close()

    # --------------------------------------------------------------------------
    # Document Trace Store Operations
    # --------------------------------------------------------------------------
    def save_trace(self, session_id: str, trace_data: Dict[str, Any]):
        """Persists full unstructured multi-agent traces, AST trees, and diff snapshots."""
        trace_data["saved_at"] = datetime.datetime.utcnow().isoformat()
        trace_data["session_id"] = session_id

        if self.mongo_client:
            try:
                db = self.mongo_client["orion_telemetry"]
                db["traces"].replace_one({"session_id": session_id}, trace_data, upsert=True)
                return
            except Exception as e:
                logger.warning(f"Mongo write error: {e}. Using JSON file fallback.")

        # Local JSON Document Storage
        trace_file = TRACES_DIR / f"{session_id}.json"
        try:
            trace_file.write_text(json.dumps(trace_data, indent=2), encoding="utf-8")
        except Exception as write_err:
            logger.warning(f"Failed to write trace JSON: {write_err}")

    def get_trace(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves complete multi-agent turn-by-turn trace logs."""
        if self.mongo_client:
            try:
                db = self.mongo_client["orion_telemetry"]
                doc = db["traces"].find_one({"session_id": session_id}, {"_id": 0})
                if doc:
                    return doc
            except Exception:
                pass

        trace_file = TRACES_DIR / f"{session_id}.json"
        if trace_file.exists():
            try:
                return json.loads(trace_file.read_text(encoding="utf-8"))
            except Exception:
                pass
        return None


db_manager = DBManager()
