"""PowerShell-friendly CLI for manual GitHub Projects as Code synchronization."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import yaml

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))

from github_client import GitHubClient, GitHubError  # noqa: E402
from schema_discovery import discover_project  # noqa: E402
from storage import SyncStorage  # noqa: E402
from sync_engine import SyncEngine  # noqa: E402
from yaml_store import load_yaml, write_yaml_atomic  # noqa: E402


CONFIG_PATH = ROOT / ".github/projects/config.yaml"


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Sincroniza Issues con GitHub Projects V2 desde YAML.")
    commands = result.add_subparsers(dest="command", required=True)
    commands.add_parser("init", help="Descubre el Project e importa Issues sin sobrescribir YAML existente.").add_argument("--task")
    plan = commands.add_parser("plan", help="Muestra cambios y conflictos sin escribir archivos ni SQLite.")
    plan.add_argument("--task")
    plan.add_argument("--json", action="store_true", dest="as_json")
    for name in ("pull", "push"):
        command = commands.add_parser(name)
        command.add_argument("--task")
    sync = commands.add_parser("sync")
    sync.add_argument("--task")
    sync.add_argument("--dry-run", action="store_true")
    schema = commands.add_parser("schema")
    schema_commands = schema.add_subparsers(dest="schema_command", required=True)
    schema_commands.add_parser("refresh")
    conflicts = commands.add_parser("conflicts")
    conflicts.add_argument("--task")
    resolve = commands.add_parser("resolve")
    resolve.add_argument("--task", required=True)
    resolve.add_argument("--property", required=True)
    resolve.add_argument("--use", required=True, choices=("local", "remote"))
    return result


def _load_config() -> dict[str, Any]:
    config = load_yaml(CONFIG_PATH)
    required = ("owner", "repository", "project_title", "tasks_dir", "schema_file", "database_file")
    missing = [key for key in required if not config.get(key)]
    if missing:
        raise ValueError(f"Faltan valores en config.yaml: {', '.join(missing)}.")
    return config


def _check_auth() -> None:
    try:
        result = subprocess.run(
            ["gh", "auth", "status", "--hostname", "github.com"],
            capture_output=True, text=True, check=False, timeout=15,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise RuntimeError("No se pudo ejecutar GitHub CLI. Instala gh y autentícate con gh auth login.") from exc
    if result.returncode:
        raise RuntimeError("GitHub CLI no está autenticado. Ejecuta gh auth login y gh auth refresh -s project.")


def _fresh_schema(client: GitHubClient, config: dict[str, Any], persist: bool) -> dict[str, Any]:
    schema = discover_project(client, config)
    if persist:
        write_yaml_atomic(ROOT / config["schema_file"], schema)
    return schema


def _engine(client: GitHubClient, config: dict[str, Any], schema: dict[str, Any], read_only: bool) -> tuple[SyncEngine, SyncStorage]:
    storage = SyncStorage(ROOT / config["database_file"], read_only=read_only)
    return SyncEngine(ROOT, config, schema, client, storage), storage


def _print_plan(plans: list[dict[str, Any]], as_json: bool = False) -> None:
    if as_json:
        compact = [
            {"task_id": plan["task_id"], "action": plan["action"], "reason": plan.get("reason"),
             "changes": [{"property": entry["property"], "action": entry["action"],
                          "base": entry.get("base"), "local": entry.get("local"), "remote": entry.get("remote")}
                         for entry in plan.get("decisions", []) if entry["action"] != "equal"]}
            for plan in plans
        ]
        print(json.dumps(compact, ensure_ascii=False, separators=(",", ":")))
        return
    counts: dict[str, int] = {}
    for plan in plans:
        action = plan["action"]
        counts[action] = counts.get(action, 0) + 1
        changes = [entry for entry in plan.get("decisions", []) if entry["action"] != "equal"]
        details = ", ".join(
            f"{entry['property']}:conflict(base={json.dumps(entry.get('base'), ensure_ascii=False)},"
            f" local={json.dumps(entry.get('local'), ensure_ascii=False)},"
            f" remote={json.dumps(entry.get('remote'), ensure_ascii=False)})"
            if entry["action"] == "conflict" else f"{entry['property']}:{entry['action']}"
            for entry in changes[:6]
        )
        if len(changes) > 6:
            details += f", +{len(changes) - 6} más"
        suffix = f" — {plan['reason']}" if plan.get("reason") else (f" — {details}" if details else "")
        print(f"{plan['task_id']}: {action}{suffix}")
    print("Resumen: " + (", ".join(f"{name}={count}" for name, count in sorted(counts.items())) or "sin cambios"))


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        config = _load_config()
        if args.command == "resolve":
            storage = SyncStorage(ROOT / config["database_file"])
            try:
                with storage.exclusive():
                    storage.resolve(args.task, args.property, args.use)
            finally:
                storage.close()
            print(f"Resolución guardada: {args.task}.{args.property} -> {args.use}")
            return 0
        if args.command == "conflicts":
            storage = SyncStorage(ROOT / config["database_file"], read_only=True)
            try:
                conflicts = storage.conflicts(args.task)
            finally:
                storage.close()
            for conflict in conflicts:
                print(json.dumps(conflict, ensure_ascii=False, separators=(",", ":")))
            if not conflicts:
                print("No hay conflictos pendientes.")
            return 0

        _check_auth()
        client = GitHubClient()
        if args.command == "schema":
            schema = _fresh_schema(client, config, persist=True)
            print(f"Esquema actualizado: {schema['project']['title']} #{schema['project']['number']}; "
                  f"{len(schema['fields'])} campos, {len(schema['items'])} items, {len(schema['labels'])} etiquetas.")
            return 0

        if args.command == "init":
            schema = _fresh_schema(client, config, persist=True)
            engine, storage = _engine(client, config, schema, read_only=False)
            try:
                with storage.exclusive():
                    written = engine.init(args.task)
            finally:
                storage.close()
            print(f"Inicialización completa: {len(written)} YAML nuevos; no se modificaron Issues remotos.")
            return 0

        selected = getattr(args, "task", None)
        schema = _fresh_schema(client, config, persist=False)
        read_only = args.command == "plan" or (args.command == "sync" and args.dry_run)
        engine, storage = _engine(client, config, schema, read_only=read_only)
        try:
            if args.command == "plan" or (args.command == "sync" and args.dry_run):
                _print_plan(engine.plans(selected), getattr(args, "as_json", False))
            else:
                with storage.exclusive():
                    plans = engine.execute(args.command, selected)
                _print_plan(plans)
        finally:
            storage.close()
        return 0
    except (GitHubError, OSError, ValueError, KeyError, RuntimeError, yaml.YAMLError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

