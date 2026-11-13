"""Three-way comparison and safe Markdown body merging."""

from __future__ import annotations

from difflib import SequenceMatcher
from typing import Any

from models import canonical


def equal(left: Any, right: Any) -> bool:
    return canonical(left) == canonical(right)


def three_way_body_merge(base: str, local: str, remote: str) -> str | None:
    """Merge disjoint line edits; return None for overlapping edits."""
    if local == remote:
        return local
    if local == base:
        return remote
    if remote == base:
        return local

    original = base.splitlines(keepends=True)

    def edits(target: str) -> list[tuple[int, int, list[str]]]:
        changed = target.splitlines(keepends=True)
        matcher = SequenceMatcher(a=original, b=changed, autojunk=False)
        return [
            (start, end, changed[new_start:new_end])
            for operation, start, end, new_start, new_end in matcher.get_opcodes()
            if operation != "equal"
        ]

    left, right = edits(local), edits(remote)
    combined = list(left)
    for remote_edit in right:
        start, end, replacement = remote_edit
        collision = False
        for local_edit in left:
            l_start, l_end, l_replacement = local_edit
            overlaps = max(start, l_start) < min(end, l_end)
            same_insertion = start == end == l_start == l_end
            insertion_inside = (
                start == end and l_start <= start <= l_end
            ) or (
                l_start == l_end and start <= l_start <= end
            )
            if same_insertion:
                if l_replacement == replacement:
                    collision = True
                    break
                return None
            if overlaps or insertion_inside:
                return None
        if not collision:
            combined.append(remote_edit)

    merged = list(original)
    for start, end, replacement in sorted(combined, key=lambda edit: (edit[0], edit[1]), reverse=True):
        merged[start:end] = replacement
    return "".join(merged)


def classify(base: dict[str, Any], local: dict[str, Any], remote: dict[str, Any]) -> list[dict[str, Any]]:
    """Classify properties as equal, pull, push, merge, or conflict."""
    decisions = []
    for key in sorted(set(base) | set(local) | set(remote)):
        base_value = base.get(key)
        local_value = local.get(key)
        remote_value = remote.get(key)
        local_changed = not equal(local_value, base_value)
        remote_changed = not equal(remote_value, base_value)
        if not local_changed and not remote_changed:
            action = "equal"
            value = remote_value
        elif local_changed and not remote_changed:
            action = "push"
            value = local_value
        elif remote_changed and not local_changed:
            action = "pull"
            value = remote_value
        elif equal(local_value, remote_value):
            action = "equal"
            value = remote_value
        elif key == "issue.body" and isinstance(base_value, str) and isinstance(local_value, str) and isinstance(remote_value, str):
            value = three_way_body_merge(base_value, local_value, remote_value)
            action = "merge" if value is not None else "conflict"
        else:
            action = "conflict"
            value = None
        decisions.append({"property": key, "action": action, "base": base_value, "local": local_value, "remote": remote_value, "value": value})
    return decisions

