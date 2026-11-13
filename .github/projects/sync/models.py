"""YAML and GraphQL data normalization helpers."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


def task_properties(task: dict[str, Any]) -> dict[str, Any]:
    """Flatten editable task fields to stable paths used by three-way merge."""
    issue = task.get("issue") or {}
    properties: dict[str, Any] = {
        "issue.title": issue.get("title"),
        "issue.body": issue.get("body"),
        "issue.assignees": issue.get("assignees", []),
        "issue.labels": issue.get("labels", []),
        # Issue state is intentionally read-only; closing Issues requires separate intent.
        "issue.state": issue.get("state"),
    }
    for name, value in (task.get("project") or {}).items():
        properties[f"project.{name}"] = value
    return properties


def apply_properties(task: dict[str, Any], values: dict[str, Any]) -> dict[str, Any]:
    """Apply property paths to a copied task while retaining unknown metadata."""
    result = deepcopy(task)
    result.setdefault("issue", {})
    result.setdefault("project", {})
    for path, value in values.items():
        section, _, name = path.partition(".")
        if section == "issue":
            result["issue"][name] = deepcopy(value)
        elif section == "project":
            if value is None:
                result["project"].pop(name, None)
            else:
                result["project"][name] = deepcopy(value)
    return result


def task_from_remote(item: dict[str, Any], repository: str) -> dict[str, Any] | None:
    """Build a task document from a linked Issue; Draft Issues stay drafts."""
    content = item.get("content") or {}
    if content.get("__typename") != "Issue":
        return None
    issue_repository = (content.get("repository") or {}).get("nameWithOwner")
    if issue_repository and issue_repository.lower() != repository.lower():
        return None

    project_values: dict[str, Any] = {}
    for entry in item.get("fieldValues", []):
        name = entry.get("fieldName")
        if not name:
            continue
        project_values[name] = deepcopy(entry.get("value"))

    marker = marker_id(content.get("body") or "")
    task_id = project_values.get("Identificador de tarea") or marker or f"GH-{content['number']}"
    return {
        "id": str(task_id),
        "github": {
            "repository": repository,
            "issue_number": content.get("number"),
            "issue_node_id": content.get("id"),
            "project_item_id": item.get("id"),
        },
        "issue": {
            "title": content.get("title", ""),
            "body": content.get("body", ""),
            "state": str(content.get("state", "OPEN")).lower(),
            "assignees": sorted(
                user.get("login", "") for user in content.get("assignees", []) if user.get("login")
            ),
            "labels": sorted(
                label.get("name", "") for label in content.get("labels", []) if label.get("name")
            ),
        },
        "project": project_values,
    }


def marker_id(body: str) -> str | None:
    """Return the stable managed task ID embedded in an Issue body."""
    import re

    match = re.search(r"<!--\s*managed-task-id:\s*([A-Za-z0-9_-]+)\s*-->", body)
    return match.group(1) if match else None


def ensure_marker(task: dict[str, Any]) -> dict[str, Any]:
    """Add a stable ID marker to new Issue bodies without changing other Markdown."""
    result = deepcopy(task)
    issue = result.setdefault("issue", {})
    body = issue.get("body") or ""
    expected = f"<!-- managed-task-id: {result['id']} -->"
    existing = marker_id(body)
    if existing and existing != result["id"]:
        raise ValueError(f"El cuerpo de {result['id']} contiene el identificador distinto {existing}.")
    if not existing:
        issue["body"] = f"{expected}\n\n{body}" if body else expected
    return result


def canonical(value: Any) -> Any:
    """Normalize nested JSON/YAML values for equality checks."""
    if isinstance(value, dict):
        return {key: canonical(value[key]) for key in sorted(value)}
    if isinstance(value, list):
        return [canonical(item) for item in value]
    return value
