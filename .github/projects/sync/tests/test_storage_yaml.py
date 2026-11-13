from pathlib import Path

import pytest

from storage import SyncStorage
from yaml_store import load_tasks, load_yaml, task_path, write_yaml_atomic


def test_yaml_round_trip_preserves_unicode_markdown_and_iso_dates(tmp_path: Path):
    task = {"id": "X-1", "issue": {"body": "## Ñ\n- [ ] café\n"}, "project": {"Fecha objetivo": "2026-11-22"}}
    path = task_path(tmp_path, task["id"])
    write_yaml_atomic(path, task)
    loaded = load_yaml(path)
    assert loaded == task
    assert isinstance(loaded["project"]["Fecha objetivo"], str)


def test_atomic_yaml_write_leaves_no_temporary_file(tmp_path: Path):
    path = task_path(tmp_path, "X-1")
    write_yaml_atomic(path, {"id": "X-1"})
    assert list(tmp_path.iterdir()) == [path]


def test_load_tasks_can_load_only_one_task_and_checks_filename(tmp_path: Path):
    write_yaml_atomic(task_path(tmp_path, "A-1"), {"id": "A-1"})
    write_yaml_atomic(task_path(tmp_path, "B-2"), {"id": "B-2"})
    assert list(load_tasks(tmp_path, "A-1")) == ["A-1"]
    (tmp_path / "WRONG.yaml").write_text("id: A-1\n", encoding="utf-8")
    with pytest.raises(ValueError, match="nombre del archivo"):
        load_tasks(tmp_path)


def test_issue_state_cannot_be_resolved_from_yaml_to_github(tmp_path: Path):
    storage = SyncStorage(tmp_path / "sync.sqlite3")
    try:
        storage.save_conflict("A-1", "issue.state", "open", "closed", "open")
        with pytest.raises(ValueError, match="solo lectura"):
            storage.resolve("A-1", "issue.state", "local")
        storage.resolve("A-1", "issue.state", "remote")
    finally:
        storage.close()


def test_sqlite_bases_hash_and_conflict_resolution(tmp_path: Path):
    storage = SyncStorage(tmp_path / "sync.sqlite3")
    try:
        storage.save_bases("A-1", {"issue.title": "base", "issue.labels": ["bug"]})
        assert storage.bases("A-1") == {"issue.title": "base", "issue.labels": ["bug"]}
        storage.save_conflict("A-1", "issue.title", "base", "local", "remote")
        storage.resolve("A-1", "issue.title", "local")
        assert storage.conflicts("A-1")[0]["resolution"] == "local"
        storage.save_bases("A-1", {"issue.title": "local"})
        assert storage.conflicts("A-1") == []
    finally:
        storage.close()


def test_sqlite_transaction_rolls_back_partial_metadata(tmp_path: Path):
    storage = SyncStorage(tmp_path / "sync.sqlite3")
    try:
        with pytest.raises(RuntimeError):
            with storage.transaction() as db:
                db.execute("INSERT INTO metadata(key,value) VALUES('partial','yes')")
                raise RuntimeError("abort")
        assert storage.connection.execute("SELECT 1 FROM metadata WHERE key='partial'").fetchone() is None
    finally:
        storage.close()


def test_read_only_storage_does_not_create_a_database(tmp_path: Path):
    path = tmp_path / "missing.sqlite3"
    storage = SyncStorage(path, read_only=True)
    try:
        assert storage.conflicts() == []
        assert not path.exists()
    finally:
        storage.close()

