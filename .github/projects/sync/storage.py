"""Transactional SQLite metadata for three-way synchronization."""

from __future__ import annotations

import hashlib
import json
import sqlite3
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

SCHEMA_VERSION = 1


class SyncStorage:
    """Store sync bases, remote identities, and pending conflict decisions."""

    def __init__(self, path: str | Path, read_only: bool = False):
        self.path = Path(path)
        self.read_only = read_only
        if read_only and self.path.exists():
            self.connection = sqlite3.connect(
                f"{self.path.resolve().as_uri()}?mode=ro", uri=True,
                timeout=30, isolation_level=None,
            )
        elif read_only:
            self.connection = sqlite3.connect(":memory:", timeout=30, isolation_level=None)
        else:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.connection = sqlite3.connect(self.path, timeout=30, isolation_level=None)
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("PRAGMA foreign_keys = ON")
        self.connection.execute("PRAGMA busy_timeout = 30000")
        if read_only and self.path.exists():
            row = self.connection.execute("SELECT value FROM metadata WHERE key='schema_version'").fetchone()
            if not row:
                self.connection.close()
                raise RuntimeError("La base SQLite existente no tiene una versión de esquema válida; ejecuta init.")
        else:
            self._migrate()

    def close(self) -> None:
        self.connection.close()

    @contextmanager
    def exclusive(self) -> Iterator[None]:
        """Prevent overlapping local mutations from separate CLI processes."""
        lock_path = self.path.parent / "sync.lock"
        lock_path.parent.mkdir(parents=True, exist_ok=True)
        with lock_path.open("a+b") as stream:
            stream.seek(0, os.SEEK_END)
            if stream.tell() == 0:
                stream.write(b"0")
                stream.flush()
            stream.seek(0)
            try:
                if os.name == "nt":
                    import msvcrt
                    msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    import fcntl
                    fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError as exc:
                raise RuntimeError("Ya hay una operación de escritura en curso para este Project en esta copia.") from exc
            try:
                yield
            finally:
                stream.seek(0)
                if os.name == "nt":
                    msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    fcntl.flock(stream.fileno(), fcntl.LOCK_UN)

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        """Commit all metadata changes atomically or roll them back together."""
        self.connection.execute("BEGIN IMMEDIATE")
        try:
            yield self.connection
        except Exception:
            self.connection.rollback()
            raise
        else:
            self.connection.commit()

    def _migrate(self) -> None:
        with self.transaction() as db:
            statements = (
                "CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
                """CREATE TABLE IF NOT EXISTS remote_items (
                    task_id TEXT PRIMARY KEY, repository TEXT NOT NULL, issue_number INTEGER,
                    issue_node_id TEXT, project_item_id TEXT, last_seen_at TEXT NOT NULL)""",
                """CREATE TABLE IF NOT EXISTS sync_bases (
                    task_id TEXT NOT NULL, property_key TEXT NOT NULL, value_json TEXT NOT NULL,
                    value_hash TEXT NOT NULL, synced_at TEXT NOT NULL,
                    PRIMARY KEY(task_id, property_key))""",
                """CREATE TABLE IF NOT EXISTS conflicts (
                    task_id TEXT NOT NULL, property_key TEXT NOT NULL, base_json TEXT,
                    local_json TEXT, remote_json TEXT, resolution TEXT, updated_at TEXT NOT NULL,
                    PRIMARY KEY(task_id, property_key))""",
                "CREATE INDEX IF NOT EXISTS idx_conflicts_resolution ON conflicts(resolution, task_id)",
            )
            for statement in statements:
                db.execute(statement)
            row = db.execute("SELECT value FROM metadata WHERE key='schema_version'").fetchone()
            if row and int(row["value"]) > SCHEMA_VERSION:
                raise RuntimeError("La base SQLite usa una versión futura del esquema.")
            db.execute(
                "INSERT INTO metadata(key,value) VALUES('schema_version',?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (str(SCHEMA_VERSION),),
            )

    def bases(self, task_id: str) -> dict[str, Any]:
        rows = self.connection.execute(
            "SELECT property_key,value_json FROM sync_bases WHERE task_id=?", (task_id,)
        ).fetchall()
        return {row["property_key"]: json.loads(row["value_json"]) for row in rows}

    def save_bases(self, task_id: str, values: dict[str, Any], clear_conflicts: bool = True) -> None:
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with self.transaction() as db:
            for key, value in values.items():
                encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
                digest = hashlib.sha256(encoded.encode("utf-8")).hexdigest()
                db.execute(
                    """INSERT INTO sync_bases(task_id,property_key,value_json,value_hash,synced_at)
                       VALUES(?,?,?,?,?) ON CONFLICT(task_id,property_key) DO UPDATE SET
                       value_json=excluded.value_json,value_hash=excluded.value_hash,synced_at=excluded.synced_at""",
                    (task_id, key, encoded, digest, now),
                )
            if clear_conflicts and values:
                placeholders = ",".join("?" for _ in values)
                db.execute(
                    f"DELETE FROM conflicts WHERE task_id=? AND property_key IN ({placeholders})",
                    (task_id, *values.keys()),
                )

    def save_identity(self, task: dict[str, Any]) -> None:
        github = task.get("github") or {}
        with self.transaction() as db:
            db.execute(
                """INSERT INTO remote_items(task_id,repository,issue_number,issue_node_id,project_item_id,last_seen_at)
                   VALUES(?,?,?,?,?,?) ON CONFLICT(task_id) DO UPDATE SET repository=excluded.repository,
                   issue_number=excluded.issue_number,issue_node_id=excluded.issue_node_id,
                   project_item_id=excluded.project_item_id,last_seen_at=excluded.last_seen_at""",
                (
                    task["id"], github.get("repository", ""), github.get("issue_number"),
                    github.get("issue_node_id"), github.get("project_item_id"),
                    datetime.now(timezone.utc).isoformat(timespec="seconds"),
                ),
            )

    def save_conflict(
        self, task_id: str, property_key: str, base: Any, local: Any, remote: Any
    ) -> None:
        def encode(value: Any) -> str | None:
            return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

        with self.transaction() as db:
            db.execute(
                """INSERT INTO conflicts(task_id,property_key,base_json,local_json,remote_json,resolution,updated_at)
                   VALUES(?,?,?,?,?,NULL,?) ON CONFLICT(task_id,property_key) DO UPDATE SET
                   base_json=excluded.base_json,local_json=excluded.local_json,remote_json=excluded.remote_json,
                   resolution=NULL,updated_at=excluded.updated_at""",
                (task_id, property_key, encode(base), encode(local), encode(remote), datetime.now(timezone.utc).isoformat(timespec="seconds")),
            )

    def conflicts(self, task_id: str | None = None) -> list[dict[str, Any]]:
        query = "SELECT * FROM conflicts" + (" WHERE task_id=?" if task_id else "") + " ORDER BY task_id,property_key"
        rows = self.connection.execute(query, (task_id,) if task_id else ()).fetchall()
        result = []
        for row in rows:
            result.append({
                "task_id": row["task_id"], "property": row["property_key"],
                "base": json.loads(row["base_json"]) if row["base_json"] is not None else None,
                "local": json.loads(row["local_json"]) if row["local_json"] is not None else None,
                "remote": json.loads(row["remote_json"]) if row["remote_json"] is not None else None,
                "resolution": row["resolution"],
            })
        return result

    def resolve(self, task_id: str, property_key: str, choice: str) -> None:
        if choice not in {"local", "remote"}:
            raise ValueError("La resolución debe ser 'local' o 'remote'.")
        if property_key == "issue.state" and choice == "local":
            raise ValueError("issue.state es de solo lectura; elige 'remote' para descartar el cambio local.")
        with self.transaction() as db:
            cursor = db.execute(
                "UPDATE conflicts SET resolution=?,updated_at=? WHERE task_id=? AND property_key=?",
                (choice, datetime.now(timezone.utc).isoformat(timespec="seconds"), task_id, property_key),
            )
            if cursor.rowcount != 1:
                raise KeyError(f"No hay conflicto pendiente para {task_id}.{property_key}.")

