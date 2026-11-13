"""Incremental manual sync between task YAML, GitHub Issues, Projects, and SQLite."""

from __future__ import annotations

import json
import re
from copy import deepcopy
from pathlib import Path
from typing import Any

from conflict_resolver import classify, equal
from github_client import GitHubClient, GitHubError
from models import apply_properties, ensure_marker, marker_id, task_from_remote, task_properties
from storage import SyncStorage
from yaml_store import load_tasks, load_yaml, task_path, write_yaml_atomic


ISSUE_FIELDS = {"issue.title", "issue.body", "issue.assignees", "issue.labels"}
READ_ONLY_ISSUE_FIELDS = {"issue.state"}
ISSUE_QUERY_FIELDS = """
id number title body state url
repository { nameWithOwner }
assignees(first:100) { nodes { login } }
labels(first:100) { nodes { id name color } }
"""


def _graphql_input(value: Any) -> str:
    """Serialize Python values as GraphQL input literals (object keys are names)."""
    if isinstance(value, dict):
        return "{" + ",".join(f"{key}:{_graphql_input(item)}" for key, item in value.items()) + "}"
    if isinstance(value, list):
        return "[" + ",".join(_graphql_input(item) for item in value) + "]"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


class SyncEngine:
    """Plan and apply property-level three-way synchronization."""

    def __init__(
        self,
        root: Path,
        config: dict[str, Any],
        schema: dict[str, Any],
        client: GitHubClient,
        storage: SyncStorage,
    ):
        self.root = root
        self.config = config
        self.schema = schema
        self.client = client
        self.storage = storage
        self.tasks_dir = root / config["tasks_dir"]
        self.project = schema.get("project") or {}

    @staticmethod
    def _yaml_task(task: dict[str, Any]) -> dict[str, Any]:
        """Keep volatile GraphQL node IDs in SQLite/schema, not versioned task files."""
        result = deepcopy(task)
        github = result.get("github") or {}
        github.pop("issue_node_id", None)
        github.pop("project_item_id", None)
        return result

    @property
    def repo(self) -> str:
        return self.config["repository"]

    @property
    def project_id(self) -> str:
        value = self.project.get("id")
        if not value:
            raise ValueError("No se ha descubierto el ID real del Project; ejecuta schema refresh.")
        return value

    def init(self, selected: str | None = None) -> list[str]:
        """Import linked and marked repo Issues without replacing local YAML."""
        legacy_metadata = self._legacy_metadata()
        by_id: dict[str, dict[str, Any]] = {}
        linked_ids = set()
        for item in self.schema.get("items", []):
            content = item.get("content") or {}
            if content.get("__typename") != "Issue":
                continue
            linked_ids.add((content.get("repository", {}).get("nameWithOwner", "").lower(), content.get("number")))
            task = task_from_remote(item, self.repo)
            if task:
                self._add_unique(by_id, task)

        # Discover existing but currently unlinked managed issues once during initialization.
        for issue in self.client.rest_pages(f"repos/{self.repo}/issues?state=all&per_page=100"):
            if "pull_request" in issue or (issue.get("repository", {}).get("nameWithOwner", self.repo).lower(), issue.get("number")) in linked_ids:
                continue
            body = issue.get("body") or ""
            task_id = marker_id(body)
            if not task_id:
                continue
            task = self._task_from_rest_issue(issue, task_id)
            self._add_unique(by_id, task)

        if selected:
            by_id = {key: value for key, value in by_id.items() if key == selected}
            if not by_id:
                raise KeyError(f"No se encontró una tarea remota con identificador {selected}.")
        written = []
        for task_id, remote_task in sorted(by_id.items()):
            path = task_path(self.tasks_dir, task_id)
            if not path.exists():
                planning = legacy_metadata.get(task_id)
                if planning:
                    remote_task["planning"] = planning
                write_yaml_atomic(path, self._yaml_task(remote_task))
                local_task = remote_task
                written.append(task_id)
            else:
                local_task = load_yaml(path)
                if local_task.get("id") != task_id:
                    raise ValueError(f"El archivo {path} contiene otro identificador.")
            self.storage.save_identity(remote_task)
            if equal(task_properties(local_task), task_properties(remote_task)):
                self.storage.save_bases(task_id, task_properties(remote_task))
        return written

    def _legacy_metadata(self) -> dict[str, dict[str, Any]]:
        """Carry planning-only fields forward from the previous combined task file."""
        legacy_path = self.root / ".github/project-management/tasks.yml"
        if not legacy_path.exists():
            return {}
        legacy = load_yaml(legacy_path)
        if not isinstance(legacy, dict) or not isinstance(legacy.get("tasks"), list):
            raise ValueError(f"Formato de migración inválido en {legacy_path}.")
        preserved_keys = {
            "area", "priority", "branch", "paths", "assignee", "requestedAssignee",
            "assignmentNote", "description", "acceptanceCriteria", "dependencies",
            "state", "targetDate", "completedAt",
        }
        return {
            task["id"]: {key: task[key] for key in preserved_keys if key in task}
            for task in legacy["tasks"]
            if isinstance(task, dict) and isinstance(task.get("id"), str)
        }

    @staticmethod
    def _add_unique(items: dict[str, dict[str, Any]], task: dict[str, Any]) -> None:
        task_id = task["id"]
        if task_id in items:
            raise ValueError(f"Identificador remoto duplicado: {task_id}.")
        items[task_id] = task

    def _task_from_rest_issue(self, issue: dict[str, Any], task_id: str) -> dict[str, Any]:
        return {
            "id": task_id,
            "github": {
                "repository": self.repo,
                "issue_number": issue.get("number"),
                "issue_node_id": issue.get("node_id"),
                "project_item_id": None,
            },
            "issue": {
                "title": issue.get("title", ""), "body": issue.get("body") or "",
                "state": str(issue.get("state", "open")).lower(),
                "assignees": sorted(user.get("login", "") for user in issue.get("assignees", []) if user.get("login")),
                "labels": sorted(label.get("name", "") for label in issue.get("labels", []) if label.get("name")),
            },
            "project": {},
        }

    def _remote_tasks(self, local_tasks: dict[str, tuple[Path, dict[str, Any]]]) -> dict[str, dict[str, Any]]:
        remote: dict[str, dict[str, Any]] = {}
        by_number: dict[int, dict[str, Any]] = {}
        for item in self.schema.get("items", []):
            task = task_from_remote(item, self.repo)
            if task:
                if task["id"] in remote:
                    raise ValueError(f"Identificador remoto duplicado: {task['id']}.")
                remote[task["id"]] = task
                number = task.get("github", {}).get("issue_number")
                if number:
                    by_number[int(number)] = task

        missing_numbers = sorted({
            int(task.get("github", {}).get("issue_number"))
            for _, task in local_tasks.values()
            if task.get("github", {}).get("issue_number")
            and int(task["github"]["issue_number"]) not in by_number
        })
        if missing_numbers:
            fetched = self._fetch_issues_by_number(missing_numbers)
            for task_id, (_, local) in local_tasks.items():
                number = (local.get("github") or {}).get("issue_number")
                if not number or int(number) in by_number:
                    continue
                issue = fetched.get(int(number))
                if issue is None:
                    # A missing Issue is kept as a conflict; it is never recreated automatically.
                    continue
                marker = marker_id(issue.get("body") or "")
                if marker and marker != task_id:
                    raise ValueError(f"El Issue #{number} pertenece a {marker}, no a {task_id}.")
                issue["assignees"] = (issue.get("assignees") or {}).get("nodes", [])
                issue["labels"] = (issue.get("labels") or {}).get("nodes", [])
                task = self._task_from_rest_issue(issue, task_id)
                remote[task_id] = task
                by_number[int(number)] = task
        return remote

    def _fetch_issues_by_number(self, numbers: list[int]) -> dict[int, dict[str, Any]]:
        aliases = []
        for index, number in enumerate(numbers):
            aliases.append(f"i{index}: issue(number:{number}) {{ {ISSUE_QUERY_FIELDS} }}")
        owner, name = self.repo.split("/", 1)
        query = f"query {{ repository(owner:{json.dumps(owner)},name:{json.dumps(name)}) {{ {' '.join(aliases)} }} }}"
        data = self.client.graphql(query)
        repository = data.get("repository") or {}
        return {number: repository.get(f"i{index}") for index, number in enumerate(numbers) if repository.get(f"i{index}")}

    def plans(self, selected: str | None = None) -> list[dict[str, Any]]:
        try:
            local_tasks = load_tasks(self.tasks_dir, selected)
        except FileNotFoundError:
            if not selected:
                raise
            local_tasks = {}
        remote_tasks = self._remote_tasks(local_tasks)
        if selected:
            remote_tasks = {key: value for key, value in remote_tasks.items() if key == selected}
        plans: list[dict[str, Any]] = []
        for task_id, (path, local_task) in sorted(local_tasks.items()):
            remote_task = remote_tasks.get(task_id)
            github = local_task.get("github") or {}
            if remote_task is None:
                if github.get("issue_number"):
                    plans.append({"task_id": task_id, "path": str(path), "action": "conflict", "reason": "Issue remoto eliminado o inaccesible; no se recrea automáticamente.", "decisions": []})
                else:
                    plans.append({"task_id": task_id, "path": str(path), "action": "create", "reason": None, "decisions": [], "local": local_task})
                continue
            remote_github = remote_task.get("github") or {}
            if github.get("issue_number") and int(github["issue_number"]) != int(remote_github.get("issue_number", -1)):
                plans.append({"task_id": task_id, "path": str(path), "action": "conflict", "reason": "El número de Issue no coincide con la identidad remota.", "decisions": []})
                continue

            local_props = task_properties(local_task)
            remote_props = task_properties(remote_task)
            base = self.storage.bases(task_id)
            if not base:
                if equal(local_props, remote_props):
                    decisions = [{"property": key, "action": "baseline", "base": None, "local": value, "remote": remote_props.get(key), "value": value} for key, value in local_props.items()]
                    action = "baseline"
                else:
                    decisions = self._unbased_conflicts(local_props, remote_props)
                    action = "conflict"
            else:
                decisions = classify(base, local_props, remote_props)
                persisted = {(conflict["property"]): conflict for conflict in self.storage.conflicts(task_id)}
                action = self._overall_action(decisions)

            persisted = {(conflict["property"]): conflict for conflict in self.storage.conflicts(task_id)}
            for decision in decisions:
                if decision["property"] == "issue.state" and decision["action"] == "push":
                    decision["action"] = "conflict"
                    decision["reason"] = "El estado de apertura/cierre del Issue es de solo lectura."
                existing = persisted.get(decision["property"])
                if (decision["action"] == "conflict" and existing and existing.get("resolution")
                        and not (decision["property"] in READ_ONLY_ISSUE_FIELDS and existing["resolution"] == "local")):
                    chosen = decision[existing["resolution"]]
                    decision["action"] = "push" if existing["resolution"] == "local" else "pull"
                    decision["value"] = chosen
            action = self._overall_action(decisions)

            plans.append({"task_id": task_id, "path": str(path), "action": action, "reason": None, "decisions": decisions, "local": local_task, "remote": remote_task})

        for task_id, remote_task in sorted(remote_tasks.items()):
            if task_id not in local_tasks:
                plans.append({"task_id": task_id, "path": str(task_path(self.tasks_dir, task_id)), "action": "pull", "reason": "Issue remoto sin YAML local.", "decisions": [], "remote": remote_task})
        return plans

    @staticmethod
    def _unbased_conflicts(local: dict[str, Any], remote: dict[str, Any]) -> list[dict[str, Any]]:
        return [{"property": key, "action": "conflict", "base": None, "local": local.get(key), "remote": remote.get(key), "value": None}
                for key in sorted(set(local) | set(remote)) if not equal(local.get(key), remote.get(key))]

    @staticmethod
    def _overall_action(decisions: list[dict[str, Any]]) -> str:
        actions = {entry["action"] for entry in decisions}
        if "conflict" in actions:
            return "conflict"
        if "push" in actions and "pull" in actions:
            return "merge"
        if "push" in actions:
            return "push"
        if "pull" in actions:
            return "pull"
        if "merge" in actions:
            return "merge"
        if "baseline" in actions:
            return "baseline"
        return "unchanged"

    def execute(self, mode: str, selected: str | None = None) -> list[dict[str, Any]]:
        """Apply safe changes in the requested direction and persist only successes."""
        if mode not in {"pull", "push", "sync"}:
            raise ValueError(f"Modo de sincronización inválido: {mode}.")
        plans = self.plans(selected)
        for plan in plans:
            task_id = plan["task_id"]
            action = plan["action"]
            if action == "conflict":
                self._persist_conflicts(plan)
                if not plan.get("decisions"):
                    continue
            if action == "create":
                if mode in {"push", "sync"}:
                    self._create_remote_task(plan["local"])
                    plan["action"] = "created"
                continue
            if action == "pull":
                if mode in {"pull", "sync"}:
                    task = plan.get("remote")
                    write_yaml_atomic(Path(plan["path"]), self._yaml_task(task))
                    self.storage.save_identity(task)
                    self.storage.save_bases(task_id, task_properties(task))
                continue
            if action == "baseline":
                local_task = plan["local"]
                old_identity = deepcopy(local_task.get("github") or {})
                local_task["github"] = deepcopy(plan["remote"].get("github") or {})
                if local_task["github"] != old_identity:
                    write_yaml_atomic(Path(plan["path"]), self._yaml_task(local_task))
                self.storage.save_bases(task_id, task_properties(plan["remote"]))
                self.storage.save_identity(plan["remote"])
                continue
            if action == "unchanged":
                task = plan.get("local")
                self.storage.save_bases(task_id, task_properties(task))
                self.storage.save_identity(plan["remote"])
                continue

            decisions = plan["decisions"]
            conflicts = [entry for entry in decisions if entry["action"] == "conflict"]
            for entry in conflicts:
                self.storage.save_conflict(task_id, entry["property"], entry["base"], entry["local"], entry["remote"])
            local_updates: dict[str, Any] = {}
            push_updates: dict[str, Any] = {}
            baseline_updates: dict[str, Any] = {}
            for entry in decisions:
                item_action = entry["action"]
                key = entry["property"]
                if item_action == "pull" and mode in {"pull", "sync"}:
                    local_updates[key] = entry["remote"]
                    baseline_updates[key] = entry["remote"]
                elif item_action == "push" and mode in {"push", "sync"}:
                    push_updates[key] = entry["local"]
                    baseline_updates[key] = entry["local"]
                elif item_action == "merge":
                    if mode == "sync":
                        local_updates[key] = entry["value"]
                        push_updates[key] = entry["value"]
                        baseline_updates[key] = entry["value"]
                    elif mode == "push":
                        local_updates[key] = entry["value"]
                        push_updates[key] = entry["value"]
                        baseline_updates[key] = entry["value"]
                    elif mode == "pull":
                        local_updates[key] = entry["value"]
                        baseline_updates[key] = entry["remote"]
                elif item_action == "conflict":
                    resolution = next((c.get("resolution") for c in self.storage.conflicts(task_id) if c["property"] == key), None)
                    if resolution == "local" and mode in {"push", "sync"}:
                        push_updates[key] = entry["local"]
                        baseline_updates[key] = entry["local"]
                        local_updates[key] = entry["local"]
                    elif resolution == "remote" and mode in {"pull", "sync"}:
                        local_updates[key] = entry["remote"]
                        baseline_updates[key] = entry["remote"]

            if any(key in READ_ONLY_ISSUE_FIELDS for key in push_updates):
                self.storage.save_conflict(task_id, "issue.state", self.storage.bases(task_id).get("issue.state"), push_updates.pop("issue.state"), task_properties(plan["remote"]).get("issue.state"))
                baseline_updates.pop("issue.state", None)
            updated_task = apply_properties(plan["local"], local_updates)
            if push_updates:
                remote_task = self._push_existing(plan["remote"], push_updates)
                updated_task["github"] = remote_task["github"]
            elif local_updates:
                updated_task["github"] = plan["remote"]["github"]
            if local_updates:
                write_yaml_atomic(Path(plan["path"]), self._yaml_task(updated_task))
            # Save only fields whose direction completed; unresolved fields retain their prior base.
            self.storage.save_bases(task_id, baseline_updates, clear_conflicts=True)
            self.storage.save_identity(updated_task if push_updates else plan["remote"])
        return plans

    def _persist_conflicts(self, plan: dict[str, Any]) -> None:
        task_id = plan["task_id"]
        if not plan.get("decisions"):
            self.storage.save_conflict(task_id, "github.identity", None, plan.get("local"), plan.get("reason"))
        for entry in plan.get("decisions", []):
            if entry["action"] == "conflict":
                self.storage.save_conflict(task_id, entry["property"], entry["base"], entry["local"], entry["remote"])

    def _create_remote_task(self, source: dict[str, Any]) -> None:
        task = ensure_marker(source)
        issue = task.get("issue") or {}
        title = issue.get("title")
        if not title:
            raise ValueError(f"La tarea {task['id']} necesita issue.title para crear un Issue.")
        existing = self._find_issue_by_marker(task["id"])
        payload = {"title": title, "body": issue.get("body") or ""}
        if issue.get("assignees"):
            payload["assignees"] = issue["assignees"]
        if issue.get("labels"):
            payload["labels"] = issue["labels"]
        if existing:
            created = self.client.rest("PATCH", f"repos/{self.repo}/issues/{existing['number']}", payload)
        else:
            created = self.client.rest("POST", f"repos/{self.repo}/issues", payload)
        if not created or not created.get("number"):
            raise GitHubError("GitHub no devolvió el Issue recién creado.")
        github = {
            "repository": self.repo,
            "issue_number": created["number"],
            "issue_node_id": created.get("node_id"),
            "project_item_id": None,
        }
        existing_item = next((
            item for item in self.schema.get("items", [])
            if (item.get("content") or {}).get("id") == created.get("node_id")
        ), None)
        item_id = existing_item.get("id") if existing_item else self._add_to_project(created.get("node_id"))
        github["project_item_id"] = item_id
        task["github"] = github
        remote = deepcopy(task)
        remote["issue"]["state"] = str(created.get("state", "open")).lower()
        write_yaml_atomic(task_path(self.tasks_dir, task["id"]), self._yaml_task(remote))
        self.storage.save_identity(remote)
        self._set_project_fields(item_id, task.get("project") or {})
        self.storage.save_bases(task["id"], task_properties(remote))

    def _find_issue_by_marker(self, task_id: str) -> dict[str, Any] | None:
        for issue in self.client.rest_pages(f"repos/{self.repo}/issues?state=all&per_page=100"):
            if "pull_request" not in issue and marker_id(issue.get("body") or "") == task_id:
                return issue
        return None

    def _add_to_project(self, issue_node_id: str | None) -> str:
        if not issue_node_id:
            raise GitHubError("GitHub no devolvió el node_id del Issue.")
        query = """
        mutation($project:ID!, $content:ID!) {
          addProjectV2ItemById(input:{projectId:$project,contentId:$content}) {
            item { id }
          }
        }
        """
        data = self.client.graphql(query, {"project": self.project_id, "content": issue_node_id})
        return data["addProjectV2ItemById"]["item"]["id"]

    def _push_existing(self, current: dict[str, Any], updates: dict[str, Any]) -> dict[str, Any]:
        task_id = current["id"]
        github = current["github"]
        issue_number = github.get("issue_number")
        if not issue_number:
            raise GitHubError(f"{task_id} no tiene Issue remoto; usa push para crear el Issue.")
        issue_payload: dict[str, Any] = {}
        for key, value in updates.items():
            if key not in ISSUE_FIELDS and key not in READ_ONLY_ISSUE_FIELDS and not key.startswith("project."):
                raise GitHubError(f"Propiedad no compatible: {key}.")
            if key == "issue.title":
                issue_payload["title"] = value
            elif key == "issue.body":
                issue_payload["body"] = value
            elif key == "issue.assignees":
                issue_payload["assignees"] = value or []
            elif key == "issue.labels":
                issue_payload["labels"] = value or []
            elif key == "issue.state":
                raise GitHubError("issue.state es de solo lectura; no se abrirán ni cerrarán Issues automáticamente.")
        project_values = {key.removeprefix("project."): value for key, value in updates.items() if key.startswith("project.")}
        if issue_payload:
            self.client.rest("PATCH", f"repos/{self.repo}/issues/{issue_number}", issue_payload)
        if project_values:
            self._set_project_fields(github.get("project_item_id"), project_values)
        updated = apply_properties(current, updates)
        updated["github"] = dict(github)
        return updated

    def _set_project_fields(self, item_id: str | None, values: dict[str, Any]) -> None:
        if not item_id and values:
            raise GitHubError("La tarea no tiene item del Project; no se actualizan campos.")
        if not values:
            return
        definitions = {field.get("name"): field for field in self.schema.get("fields", [])}
        mutations = []
        for index, (name, value) in enumerate(values.items()):
            field = definitions.get(name)
            if not field:
                raise GitHubError(f"El campo de Project {name!r} ya no existe; ejecuta schema refresh.")
            field_id = field.get("id")
            data_type = field.get("dataType")
            if value is None:
                mutations.append(
                    f"m{index}: clearProjectV2ItemFieldValue(input:{{projectId:{json.dumps(self.project_id)},itemId:{json.dumps(item_id)},fieldId:{json.dumps(field_id)}}}){{clientMutationId}}"
                )
                continue
            if data_type == "SINGLE_SELECT":
                option = next((option for option in field.get("options", []) if option.get("name") == value), None)
                if not option:
                    raise GitHubError(f"El valor {value!r} ya no existe como opción de {name!r}.")
                graph_value = {"singleSelectOptionId": option["id"]}
            elif data_type == "TEXT":
                graph_value = {"text": str(value)}
            elif data_type == "DATE":
                if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(value)):
                    raise ValueError(f"Fecha inválida en {name}: {value!r}.")
                graph_value = {"date": str(value)}
            elif data_type == "NUMBER":
                if isinstance(value, bool) or not isinstance(value, (int, float)):
                    raise ValueError(f"El campo {name!r} requiere un número.")
                graph_value = {"number": value}
            else:
                raise GitHubError(f"No se puede escribir el tipo {data_type!r} del campo {name!r}; se preserva intacto.")
            mutations.append(
                f"m{index}: updateProjectV2ItemFieldValue(input:{{projectId:{json.dumps(self.project_id)},itemId:{json.dumps(item_id)},fieldId:{json.dumps(field_id)},value:{_graphql_input(graph_value)}}}){{clientMutationId}}"
            )
        if mutations:
            self.client.graphql("mutation { " + " ".join(mutations) + " }")

