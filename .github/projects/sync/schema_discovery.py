"""Discover a project's live schema and linked Issue inventory."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from github_client import GitHubClient


PROJECTS_QUERY = """
query($owner:String!, $after:String) {
  user(login:$owner) {
    projectsV2(first:100, after:$after) {
      nodes { id number title url }
      pageInfo { hasNextPage endCursor }
    }
  }
}
"""

PROJECT_PAGE_QUERY = """
query($owner:String!, $number:Int!, $after:String) {
  user(login:$owner) {
    projectV2(number:$number) {
      id number title url
      repositories(first:100) { nodes { nameWithOwner } }
      fields(first:100) { nodes {
        ... on ProjectV2FieldCommon { __typename id name dataType }
        ... on ProjectV2SingleSelectField { __typename id name options { id name } }
      } }
      items(first:100, after:$after) {
        nodes {
          id
          content {
            __typename
            ... on Issue {
              id number title body state url
              repository { nameWithOwner }
              assignees(first:100) { nodes { login } }
              labels(first:100) { nodes { id name color } }
            }
            ... on DraftIssue {
              id title body creator { login }
              assignees(first:100) { nodes { login } }
            }
          }
          fieldValues(first:100) { nodes {
            __typename
            ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { id name dataType } } }
            ... on ProjectV2ItemFieldDateValue { date field { ... on ProjectV2FieldCommon { id name dataType } } }
            ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2FieldCommon { id name dataType } } }
            ... on ProjectV2ItemFieldSingleSelectValue { name optionId field { ... on ProjectV2FieldCommon { id name dataType } } }
            ... on ProjectV2ItemFieldIterationValue { title field { ... on ProjectV2FieldCommon { id name dataType } } }
            ... on ProjectV2ItemFieldRepositoryValue { repository { nameWithOwner } field { ... on ProjectV2FieldCommon { id name dataType } } }
          } }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}
"""


def _field_value(value: dict[str, Any]) -> tuple[str, Any] | None:
    field = value.get("field") or {}
    name = field.get("name")
    if not name:
        return None
    typename = value.get("__typename", "")
    if typename.endswith("TextValue"):
        result = value.get("text")
    elif typename.endswith("DateValue"):
        result = value.get("date")
    elif typename.endswith("NumberValue"):
        result = value.get("number")
    elif typename.endswith("SingleSelectValue"):
        result = value.get("name")
    elif typename.endswith("IterationValue"):
        result = value.get("title")
    elif typename.endswith("UserValue"):
        result = (value.get("user") or {}).get("login")
    elif typename.endswith("LabelValue"):
        result = (value.get("label") or {}).get("name")
    elif typename.endswith("RepositoryValue"):
        result = (value.get("repository") or {}).get("nameWithOwner")
    else:
        result = {"__typename": typename}
    return name, result


def _normalize_item(item: dict[str, Any]) -> dict[str, Any]:
    content = item.get("content") or {}
    if content.get("__typename") == "Issue":
        content = {
            **content,
            "assignees": (content.get("assignees") or {}).get("nodes", []),
            "labels": (content.get("labels") or {}).get("nodes", []),
        }
    elif content.get("__typename") == "DraftIssue":
        content = {
            **content,
            "assignees": (content.get("assignees") or {}).get("nodes", []),
        }
    values = []
    for raw in (item.get("fieldValues") or {}).get("nodes", []):
        normalized = _field_value(raw)
        if normalized:
            values.append({"fieldName": normalized[0], "value": normalized[1]})
    return {"id": item["id"], "content": content, "fieldValues": values}


def discover_project(client: GitHubClient, config: dict[str, Any]) -> dict[str, Any]:
    """Resolve project identity and fetch its fields/items with cursor pagination."""
    owner = config["owner"]
    projects = []
    cursor: str | None = None
    while True:
        data = client.graphql(PROJECTS_QUERY, {"owner": owner, "after": cursor})
        connection = ((data.get("user") or {}).get("projectsV2") or {})
        projects.extend(connection.get("nodes", []))
        page_info = connection.get("pageInfo") or {}
        if not page_info.get("hasNextPage"):
            break
        next_cursor = page_info.get("endCursor")
        if not next_cursor or next_cursor == cursor:
            raise ValueError("GitHub devolvió un cursor inválido al listar Projects.")
        cursor = next_cursor
    number = config.get("project_number")
    project_id = config.get("project_id")
    candidates = [
        project for project in projects
        if (number is None or project.get("number") == int(number))
        and (project_id is None or project.get("id") == project_id)
        and project.get("title") == config["project_title"]
    ]
    if len(candidates) != 1:
        raise ValueError(
            f"Se esperaba un Project único llamado {config['project_title']!r}; encontrados: {len(candidates)}."
        )

    selected = candidates[0]
    items: list[dict[str, Any]] = []
    fields: list[dict[str, Any]] | None = None
    repositories: list[dict[str, Any]] | None = None
    cursor: str | None = None
    while True:
        page_data = client.graphql(
            PROJECT_PAGE_QUERY,
            {"owner": owner, "number": int(selected["number"]), "after": cursor},
        )
        project = ((page_data.get("user") or {}).get("projectV2") or {})
        if not project or project.get("id") != selected["id"]:
            raise ValueError("El Project cambió durante la consulta; ejecuta nuevamente schema refresh.")
        if fields is None:
            fields = (project.get("fields") or {}).get("nodes", [])
            repositories = (project.get("repositories") or {}).get("nodes", [])
        connection = project.get("items") or {}
        items.extend(_normalize_item(item) for item in connection.get("nodes", []))
        page_info = connection.get("pageInfo") or {}
        if not page_info.get("hasNextPage"):
            break
        next_cursor = page_info.get("endCursor")
        if not next_cursor or next_cursor == cursor:
            raise ValueError("GitHub devolvió un cursor de paginación inválido.")
        cursor = next_cursor

    repository_names = sorted(
        {repo.get("nameWithOwner") for repo in (repositories or []) if repo.get("nameWithOwner")}
    )
    configured_repo = config["repository"].lower()
    if configured_repo not in {name.lower() for name in repository_names}:
        raise ValueError(f"El repositorio {config['repository']} no está vinculado al Project configurado.")

    labels = []
    for label in client.rest_pages(f"repos/{config['repository']}/labels?per_page=100"):
        labels.append({"id": label.get("node_id"), "name": label.get("name"), "color": label.get("color")})
    observed_assignees = sorted({
        user["login"]
        for item in items
        for user in (item.get("content") or {}).get("assignees", [])
        if user.get("login")
    })
    normalized_fields = []
    for field in fields or []:
        normalized_fields.append({
            key: value for key, value in field.items()
            if key in {"__typename", "id", "name", "dataType", "options"}
        })
    return {
        "version": 1,
        "refreshed_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "project": {**selected, "owner": owner},
        "repositories": repository_names,
        "fields": normalized_fields,
        "items": items,
        "labels": sorted(labels, key=lambda entry: entry.get("name") or ""),
        "assignees": observed_assignees,
    }

