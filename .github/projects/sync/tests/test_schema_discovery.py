from schema_discovery import discover_project


class FakeClient:
    def __init__(self):
        self.label_requests = 0

    def graphql(self, query, variables=None):
        variables = variables or {}
        if "projectsV2" in query:
            if variables.get("after") is None:
                return {"user": {"projectsV2": {"nodes": [{"id": "P1", "number": 7, "title": "ERP + CRM Multitenant", "url": "https://example/p/7"}], "pageInfo": {"hasNextPage": False}}}}
        if "projectV2(number" in query:
            item1 = {
                "id": "PI1",
                "content": {"__typename": "Issue", "id": "I1", "number": 1, "title": "Tarea", "body": "## Ñ", "state": "OPEN", "url": "https://example/issues/1", "repository": {"nameWithOwner": "jeffersonmejia/app-distribuidas"}, "assignees": {"nodes": [{"login": "jeffersonmejia"}]}, "labels": {"nodes": [{"id": "L1", "name": "backend", "color": "123456"}]}},
                "fieldValues": {"nodes": [
                    {"__typename": "ProjectV2ItemFieldSingleSelectValue", "name": "Done", "optionId": "O1", "field": {"id": "F1", "name": "Status", "dataType": "SINGLE_SELECT"}},
                    {"__typename": "ProjectV2ItemFieldSingleSelectValue", "name": "Todo", "optionId": "O2", "field": {"id": "F2", "name": "Estado", "dataType": "SINGLE_SELECT"}},
                    {"__typename": "ProjectV2ItemFieldDateValue", "date": "2026-11-22", "field": {"id": "F3", "name": "Fecha objetivo", "dataType": "DATE"}},
                ]},
            }
            draft = {"id": "PI2", "content": {"__typename": "DraftIssue", "id": "D1", "title": "Borrador", "body": "no convertir", "creator": {"login": "x"}, "assignees": {"nodes": []}}, "fieldValues": {"nodes": []}}
            return {"user": {"projectV2": {
                "id": "P1", "number": 7, "title": "ERP + CRM Multitenant", "url": "https://example/p/7",
                "repositories": {"nodes": [{"nameWithOwner": "jeffersonmejia/app-distribuidas"}]},
                "fields": {"nodes": [
                    {"__typename": "ProjectV2SingleSelectField", "id": "F1", "name": "Status", "options": [{"id": "O1", "name": "Done"}]},
                    {"__typename": "ProjectV2SingleSelectField", "id": "F2", "name": "Estado", "options": [{"id": "O2", "name": "Todo"}]},
                    {"__typename": "ProjectV2Field", "id": "F3", "name": "Fecha objetivo", "dataType": "DATE"},
                ]},
                "items": {"nodes": [item1, draft] if variables.get("after") is None else [], "pageInfo": {"hasNextPage": False, "endCursor": None}},
            }}}
        raise AssertionError(f"Unexpected query: {query}")

    def rest_pages(self, path):
        self.label_requests += 1
        return [{"node_id": "L1", "name": "backend", "color": "123456"}, {"node_id": "L2", "name": "testing", "color": "abcdef"}]


def test_schema_refresh_discovers_project_fields_items_drafts_and_labels():
    client = FakeClient()
    schema = discover_project(client, {
        "owner": "jeffersonmejia", "repository": "jeffersonmejia/app-distribuidas",
        "project_title": "ERP + CRM Multitenant", "project_number": None, "project_id": None,
    })
    assert schema["project"]["id"] == "P1"
    assert {field["name"] for field in schema["fields"]} == {"Status", "Estado", "Fecha objetivo"}
    assert len(schema["items"]) == 2
    assert schema["items"][0]["fieldValues"][-1] == {"fieldName": "Fecha objetivo", "value": "2026-11-22"}
    assert {label["name"] for label in schema["labels"]} == {"backend", "testing"}
    assert schema["assignees"] == ["jeffersonmejia"]
    assert client.label_requests == 1


def test_schema_requires_unique_project_and_matching_repository():
    client = FakeClient()
    client.graphql = lambda query, variables=None: {"user": {"projectsV2": {"nodes": []}}}
    try:
        discover_project(client, {"owner": "x", "repository": "o/r", "project_title": "missing", "project_number": None, "project_id": None})
    except ValueError as exc:
        assert "encontrados: 0" in str(exc)
    else:
        raise AssertionError("Expected a missing project error")

