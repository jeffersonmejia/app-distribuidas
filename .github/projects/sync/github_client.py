"""Authenticated, paginated GitHub API access through GitHub CLI."""

from __future__ import annotations

import json
import subprocess
import time
from typing import Any


class GitHubError(RuntimeError):
    """Safe, user-facing GitHub API failure."""


class GitHubClient:
    """Run bounded GitHub API calls using credentials held by ``gh``."""

    def __init__(self, runner=subprocess.run, sleep=time.sleep, retries: int = 4):
        self.runner = runner
        self.sleep = sleep
        self.retries = retries

    def _run(self, args: list[str], *, input_text: str | None = None) -> Any:
        for attempt in range(self.retries + 1):
            result = self.runner(
                ["gh", *args],
                input=input_text,
                text=True,
                encoding="utf-8",
                errors="replace",
                capture_output=True,
                check=False,
            )
            if result.returncode == 0:
                try:
                    output = result.stdout or ""
                    return json.loads(output) if output.strip() else None
                except json.JSONDecodeError as exc:
                    raise GitHubError("GitHub devolvió una respuesta JSON inválida.") from exc

            message = (result.stderr or result.stdout or "Fallo de GitHub CLI").strip()
            transient = any(
                marker in message.lower()
                for marker in ("rate limit", "secondary rate", "502", "503", "504", "timed out", "temporarily")
            )
            if transient and attempt < self.retries:
                self.sleep(min(2**attempt, 30))
                continue
            # gh diagnostics may include request details; never echo command arguments or credentials.
            raise GitHubError(message[:500])
        raise GitHubError("GitHub API excedió el número de reintentos.")

    def graphql(self, query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
        args = ["api", "graphql", "-f", f"query={query}"]
        for name, value in (variables or {}).items():
            if value is None:
                continue
            flag = "-F" if isinstance(value, (int, bool)) else "-f"
            args.extend([flag, f"{name}={str(value).lower() if isinstance(value, bool) else value}"])
        response = self._run(args) or {}
        if response.get("errors"):
            message = "; ".join(str(error.get("message", "GraphQL error")) for error in response["errors"])
            raise GitHubError(message[:500])
        return response.get("data") or {}

    def rest(self, method: str, path: str, fields: dict[str, Any] | None = None) -> Any:
        args = ["api", "--method", method.upper(), path]
        if fields is not None:
            args.extend(["--input", "-"])
            payload = json.dumps(fields, ensure_ascii=False, separators=(",", ":"))
            return self._run(args, input_text=payload)
        return self._run(args)

    def rest_pages(self, path: str) -> list[Any]:
        """Fetch all REST pages through gh pagination without per-item queries."""
        result = self._run(["api", path, "--paginate", "--slurp"])
        if not isinstance(result, list):
            return []
        pages: list[Any] = []
        for page in result:
            pages.extend(page if isinstance(page, list) else [page])
        return pages

