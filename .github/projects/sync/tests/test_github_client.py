from types import SimpleNamespace

import pytest

from github_client import GitHubClient, GitHubError


def test_graphql_skips_null_cursor_and_uses_typed_variables():
    calls = []

    def runner(args, **kwargs):
        calls.append(args)
        return SimpleNamespace(returncode=0, stdout='{"data":{"ok":true}}', stderr="")

    client = GitHubClient(runner=runner)
    assert client.graphql("query", {"after": None, "number": 4}) == {"ok": True}
    assert "after=None" not in calls[0]
    assert "-F" in calls[0]


def test_transient_rate_limit_retries_with_backoff():
    calls = []
    sleeps = []

    def runner(args, **kwargs):
        calls.append(args)
        if len(calls) == 1:
            return SimpleNamespace(returncode=1, stdout="", stderr="secondary rate limit")
        return SimpleNamespace(returncode=0, stdout='{"ok":true}', stderr="")

    client = GitHubClient(runner=runner, sleep=sleeps.append)
    assert client._run(["api", "graphql"]) == {"ok": True}
    assert len(calls) == 2
    assert sleeps == [1]


def test_permanent_api_error_is_bounded_and_redacted_from_arguments():
    def runner(args, **kwargs):
        return SimpleNamespace(returncode=1, stdout="", stderr="permission denied")

    client = GitHubClient(runner=runner, retries=0)
    with pytest.raises(GitHubError, match="permission denied"):
        client._run(["api", "graphql", "--input", "secret-never-rendered"])


def test_rest_sends_one_json_payload_for_arrays_and_unicode():
    seen = {}
    seen_args = {}

    def runner(args, **kwargs):
        seen.update(kwargs)
        seen_args["args"] = args
        return SimpleNamespace(returncode=0, stdout='{"ok":true}', stderr="")

    client = GitHubClient(runner=runner)
    client.rest("PATCH", "repos/o/r/issues/1", {"labels": ["bug", "área"], "title": "ñ"})
    assert seen["input"] == '{"labels":["bug","área"],"title":"ñ"}'
    assert "--input" in seen_args["args"] and "-f" not in seen_args["args"]


def test_rest_pages_flattens_all_paginated_array_pages():
    def runner(args, **kwargs):
        return SimpleNamespace(returncode=0, stdout='[[{"name":"a"}],[{"name":"b"}]]', stderr="")

    assert GitHubClient(runner=runner).rest_pages("repos/o/r/labels") == [{"name": "a"}, {"name": "b"}]

