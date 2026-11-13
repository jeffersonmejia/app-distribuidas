"""Small, atomic helpers for per-task YAML files."""

from __future__ import annotations

import os
import re
import tempfile
from pathlib import Path
from typing import Any

import yaml


class TaskLoader(yaml.SafeLoader):
    """Preserve ISO dates as strings so round trips do not change their type."""


TaskLoader.add_constructor(
    "tag:yaml.org,2002:timestamp",
    lambda loader, node: loader.construct_scalar(node),
)


def load_yaml(path: Path) -> Any:
    with path.open("r", encoding="utf-8-sig") as stream:
        return yaml.load(stream, Loader=TaskLoader)


def dump_yaml(value: Any) -> str:
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=1000)


def task_path(tasks_dir: Path, task_id: str) -> Path:
    if not re.fullmatch(r"[A-Za-z0-9_-]+", task_id):
        raise ValueError(f"Identificador de tarea inválido: {task_id!r}.")
    return tasks_dir / f"{task_id}.yaml"


def write_yaml_atomic(path: Path, value: Any) -> None:
    """Replace one YAML file atomically, preserving its directory-local recovery."""
    path.parent.mkdir(parents=True, exist_ok=True)
    data = dump_yaml(value)
    temp_name = None
    try:
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", newline="\n", dir=path.parent,
            prefix=f".{path.name}.", suffix=".tmp", delete=False,
        ) as stream:
            temp_name = stream.name
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp_name, path)
    finally:
        if temp_name and os.path.exists(temp_name):
            os.unlink(temp_name)


def load_tasks(tasks_dir: Path, selected: str | None = None) -> dict[str, tuple[Path, dict[str, Any]]]:
    paths = [task_path(tasks_dir, selected)] if selected else sorted(tasks_dir.glob("*.yaml"))
    tasks: dict[str, tuple[Path, dict[str, Any]]] = {}
    for path in paths:
        if not path.exists():
            if selected:
                raise FileNotFoundError(f"No existe la tarea {selected}: {path}")
            continue
        task = load_yaml(path)
        if not isinstance(task, dict) or not isinstance(task.get("id"), str):
            raise ValueError(f"YAML de tarea inválido: {path}")
        if task_path(tasks_dir, task["id"]).resolve() != path.resolve():
            raise ValueError(f"El nombre del archivo debe ser {task['id']}.yaml: {path}")
        if task["id"] in tasks:
            raise ValueError(f"Identificador duplicado en YAML: {task['id']}.")
        tasks[task["id"]] = (path, task)
    return tasks

