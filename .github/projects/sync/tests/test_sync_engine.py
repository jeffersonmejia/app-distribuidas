from copy import deepcopy
from pathlib import Path

import pytest

from models import task_from_remote, task_properties
from storage import SyncStorage
from sync_engine import SyncEngine
from yaml_store import load_yaml, task_path, write_yaml_atomic


class FakeClient:
    def __init__(self):
        self.graphql_calls = []
        self.rest_calls = []
        self.pages = []
        self.fail_rest = False

    def graphql(self, query, variables=None):
        self.graphql_calls.append((query, variables))
        return {"updateProjectV2ItemFieldValue": {"clientMutationId": None}}

    def rest(self, method, path, fields=None):
        self.rest_calls.append((method, path, fields))
        if self.fail_rest:
            raise RuntimeError("remote write failed")
        return {"number": 19, "node_id": "ISSUE19", "state": "open"}

    def rest_pages(self, path):
        return self.pages


def remote_item(*, title="Title", body="base\n", status="Todo", estado="Todo", issue_state="OPEN", labels=None, number=1):
    fields = [
        ("Status", status, "SINGLE_SELECT"),
        ("Estado", estado, "SINGLE_SELECT"),
    ]
    field_values = [
        {"__typename": "ProjectV2ItemFieldSingleSelectValue", "name": value, "field": {"name": name, "dataType": kind}}
        for name, value, kind in fields
    ]
    field_values.append({"__typename": "ProjectV2ItemFieldTextValue", "text": "T-1", "field": {"name": "Identificador de tarea", "dataType": "TEXT"}})
    content = {"__typename": "Issue", "id": f"ISSUE{number}", "number": number, "title": title, "body": body, "state": issue_state,
               "repository": {"nameWithOwner": "o/r"}, "assignees": [{"login": "alice"}],
               "labels": [{"name": item} for item in (labels if labels is not None else ["backend"])]}
    return {"id": f"ITEM{number}", "content": content, "fieldValues": [{"fieldName": "Status", "value": status}, {"fieldName": "Estado", "value": estado}, {"fieldName": "Identificador de tarea", "value": "T-1"}]}


def make_task(*, title="Title", body="base\n", status="Todo", estado="Todo", issue_state="open", labels=None, number=1):
    return {
        "id": "T-1",
        "github": {"repository": "o/r", "issue_number": number, "issue_node_id": f"ISSUE{number}", "project_item_id": f"ITEM{number}"},
        "issue": {"title": title, "body": body, "state": issue_state, "assignees": ["alice"], "labels": labels or ["backend"]},
        "project": {"Status": status, "Estado": estado, "Identificador de tarea": "T-1"},
    }


def build_engine(tmp_path: Path, task, remote, *, fake=None, base=True, base_task=None, storage_path=None):
    tasks_dir = tmp_path / ".github/projects/tasks"
    tasks_dir.mkdir(parents=True, exist_ok=True)
    if task is not None:
        write_yaml_atomic(task_path(tasks_dir, task["id"]), task)
    storage = SyncStorage(storage_path or tmp_path / ".github/projects/.cache/test.sqlite3")
    if base and task is not None and remote is not None:
        remote_task = task_from_remote(remote, "o/r")
        storage.save_bases(task["id"], task_properties(base_task or task))
        storage.save_identity(remote_task)
    fields = [
        {"id": "SF", "name": "Status", "dataType": "SINGLE_SELECT", "options": [{"id": "D", "name": "Done"}, {"id": "T", "name": "Todo"}]},
        {"id": "EF", "name": "Estado", "dataType": "SINGLE_SELECT", "options": [{"id": "D", "name": "Done"}, {"id": "T", "name": "Todo"}]},
        {"id": "IDF", "name": "Identificador de tarea", "dataType": "TEXT"},
    ]
    schema = {"project": {"id": "P1", "number": 1}, "fields": fields, "items": [remote] if remote else [], "labels": []}
    client = fake or FakeClient()
    engine = SyncEngine(tmp_path, {"repository": "o/r", "tasks_dir": ".github/projects/tasks"}, schema, client, storage)
    return engine, storage, client


def test_plan_does_not_write_sqlite_or_yaml(tmp_path: Path):
    task = make_task()
    remote = remote_item()
    db_path = tmp_path / "sync.sqlite3"
    engine, storage, _ = build_engine(tmp_path, task, remote, storage_path=db_path)
    storage.close()
    before = task_path(tmp_path / ".github/projects/tasks", "T-1").read_bytes()
    read_only = SyncStorage(db_path, read_only=True)
    engine.storage = read_only
    try:
        assert engine.plans()[0]["action"] == "unchanged"
    finally:
        read_only.close()
    assert task_path(tmp_path / ".github/projects/tasks", "T-1").read_bytes() == before


def test_remote_only_property_is_pulled_and_second_plan_is_idempotent(tmp_path: Path):
    task, remote = make_task(), remote_item(estado="Done")
    engine, storage, _ = build_engine(tmp_path, task, remote, base_task=make_task())
    try:
        assert engine.plans()[0]["action"] == "pull"
        engine.execute("pull")
        pulled = load_yaml(task_path(engine.tasks_dir, "T-1"))
        assert pulled["project"]["Estado"] == "Done"
        assert "issue_node_id" not in pulled["github"] and "project_item_id" not in pulled["github"]
        assert storage.connection.execute("SELECT issue_node_id FROM remote_items WHERE task_id='T-1'").fetchone()[0] == "ISSUE1"
        assert engine.plans()[0]["action"] == "unchanged"
    finally:
        storage.close()


def test_local_only_change_pushes_issue_once(tmp_path: Path):
    task, remote = make_task(title="Local"), remote_item()
    engine, storage, client = build_engine(tmp_path, task, remote, base_task=make_task())
    try:
        assert engine.plans()[0]["action"] == "push"
        engine.execute("push")
        assert client.rest_calls == [("PATCH", "repos/o/r/issues/1", {"title": "Local"})]
        assert storage.bases("T-1")["issue.title"] == "Local"
    finally:
        storage.close()


def test_nonconflicting_issue_and_project_edits_merge_in_sync(tmp_path: Path):
    task, remote = make_task(title="Local"), remote_item(estado="Done")
    engine, storage, client = build_engine(tmp_path, task, remote, base_task=make_task())
    try:
        assert engine.plans()[0]["action"] == "merge"
        engine.execute("sync")
        assert client.rest_calls[0][2] == {"title": "Local"}
        assert load_yaml(task_path(engine.tasks_dir, "T-1"))["project"]["Estado"] == "Done"
        assert not client.graphql_calls
    finally:
        storage.close()


def test_divergent_same_property_is_recorded_without_overwrite(tmp_path: Path):
    task, remote = make_task(title="Local"), remote_item(title="Remote")
    engine, storage, client = build_engine(tmp_path, task, remote, base_task=make_task())
    try:
        plan = engine.plans()[0]
        assert plan["action"] == "conflict"
        engine.execute("sync")
        conflict = storage.conflicts("T-1")[0]
        assert conflict["property"] == "issue.title"
        assert conflict["base"] == "Title" and conflict["local"] == "Local" and conflict["remote"] == "Remote"
        assert not client.rest_calls
    finally:
        storage.close()


def test_explicit_resolution_persists_and_applies_local_choice(tmp_path: Path):
    task, remote = make_task(title="Local"), remote_item(title="Remote")
    engine, storage, client = build_engine(tmp_path, task, remote, base_task=make_task())
    try:
        engine.execute("sync")
        storage.resolve("T-1", "issue.title", "local")
        engine.execute("sync")
        assert client.rest_calls[-1][2] == {"title": "Local"}
        assert not storage.conflicts("T-1")
    finally:
        storage.close()


def test_unbased_differences_conflict_after_sqlite_rebuild(tmp_path: Path):
    task, remote = make_task(title="Local"), remote_item(title="Remote")
    engine, storage, _ = build_engine(tmp_path, task, remote, base=False)
    try:
        assert engine.plans()[0]["action"] == "conflict"
        engine.execute("sync")
        assert len(storage.conflicts("T-1")) > 0
    finally:
        storage.close()


def test_deleted_remote_issue_is_never_recreated_automatically(tmp_path: Path):
    task = make_task()
    engine, storage, client = build_engine(tmp_path, task, None, base=False)
    try:
        plan = engine.plans()[0]
        assert plan["action"] == "conflict"
        engine.execute("sync")
        assert not client.rest_calls
    finally:
        storage.close()


def test_closed_issue_state_pulls_without_closing_other_issues(tmp_path: Path):
    task, remote = make_task(), remote_item(issue_state="CLOSED")
    engine, storage, client = build_engine(tmp_path, task, remote, base_task=make_task())
    try:
        engine.execute("pull")
        assert load_yaml(task_path(engine.tasks_dir, "T-1"))["issue"]["state"] == "closed"
        assert not client.rest_calls
    finally:
        storage.close()


def test_status_and_custom_estado_are_independent_properties(tmp_path: Path):
    task, remote = make_task(status="Done", estado="Todo"), remote_item(status="Todo", estado="Todo")
    engine, storage, _ = build_engine(tmp_path, task, remote, base_task=make_task(status="Todo", estado="Todo"))
    # Local Status changes while Estado stays unchanged; the planner does not mirror one into the other.
    try:
        plan = engine.plans()[0]
        assert next(entry for entry in plan["decisions"] if entry["property"] == "project.Status")["action"] == "push"
        assert next(entry for entry in plan["decisions"] if entry["property"] == "project.Estado")["action"] == "equal"
    finally:
        storage.close()


def test_project_field_mutation_uses_valid_graphql_input_syntax(tmp_path: Path):
    task, remote = make_task(status="Done"), remote_item(status="Todo")
    engine, storage, client = build_engine(tmp_path, task, remote, base_task=make_task(status="Todo"))
    try:
        engine.execute("push")
        query = client.graphql_calls[0][0]
        assert "value:{singleSelectOptionId:\"D\"}" in query
        assert 'value:{"singleSelectOptionId"' not in query
    finally:
        storage.close()


def test_failed_remote_write_does_not_advance_sync_base(tmp_path: Path):
    task, remote = make_task(title="Local"), remote_item()
    client = FakeClient()
    client.fail_rest = True
    engine, storage, _ = build_engine(tmp_path, task, remote, fake=client, base_task=make_task())
    previous = storage.bases("T-1")
    try:
        with pytest.raises(RuntimeError, match="remote write failed"):
            engine.execute("push")
        assert storage.bases("T-1") == previous
    finally:
        storage.close()


def test_new_task_is_planned_without_writing_until_push(tmp_path: Path):
    task = make_task(number=None)
    task["github"] = {"repository": "o/r", "issue_number": None, "issue_node_id": None, "project_item_id": None}
    task["project"] = {}
    engine, storage, client = build_engine(tmp_path, task, None, base=False)
    try:
        assert engine.plans()[0]["action"] == "create"
        assert not client.rest_calls
    finally:
        storage.close()


def test_labeled_fields_are_compared_as_complete_lists(tmp_path: Path):
    task, remote = make_task(labels=["backend", "testing"]), remote_item(labels=["backend"])
    engine, storage, _ = build_engine(tmp_path, task, remote, base_task=make_task())
    try:
        decision = next(entry for entry in engine.plans()[0]["decisions"] if entry["property"] == "issue.labels")
        assert decision["action"] == "push"
    finally:
        storage.close()


def test_body_local_and_remote_disjoint_changes_merge_safely(tmp_path: Path):
    base = "one\ntwo\nthree\n"
    task, remote = make_task(body="ONE\ntwo\nthree\n"), remote_item(body=base)
    remote["content"]["body"] = "one\ntwo\nTHREE\n"
    engine, storage, _ = build_engine(tmp_path, task, remote, base_task=make_task(body=base))
    try:
        decision = next(entry for entry in engine.plans()[0]["decisions"] if entry["property"] == "issue.body")
        assert decision["action"] == "merge"
        assert decision["value"] == "ONE\ntwo\nTHREE\n"
    finally:
        storage.close()

