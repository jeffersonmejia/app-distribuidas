from conflict_resolver import classify, three_way_body_merge


def test_identical_changes_are_not_a_conflict():
    result = classify({"issue.title": "A"}, {"issue.title": "B"}, {"issue.title": "B"})
    assert result[0]["action"] == "equal"


def test_local_only_change_pushes():
    result = classify({"issue.title": "A"}, {"issue.title": "B"}, {"issue.title": "A"})
    assert result[0]["action"] == "push"


def test_remote_only_change_pulls():
    result = classify({"issue.title": "A"}, {"issue.title": "A"}, {"issue.title": "B"})
    assert result[0]["action"] == "pull"


def test_same_property_divergence_conflicts():
    result = classify({"issue.title": "A"}, {"issue.title": "B"}, {"issue.title": "C"})
    assert result[0]["action"] == "conflict"
    assert result[0]["base"] == "A"


def test_different_properties_merge_independently():
    result = classify(
        {"issue.title": "A", "project.Estado": "Todo"},
        {"issue.title": "B", "project.Estado": "Todo"},
        {"issue.title": "A", "project.Estado": "Done"},
    )
    assert [entry["action"] for entry in result] == ["push", "pull"]


def test_body_disjoint_line_edits_merge():
    base = "one\ntwo\nthree\n"
    merged = three_way_body_merge(base, "ONE\ntwo\nthree\n", "one\ntwo\nTHREE\n")
    assert merged == "ONE\ntwo\nTHREE\n"


def test_body_overlapping_edits_conflict():
    assert three_way_body_merge("a\nb\n", "a\nlocal\n", "a\nremote\n") is None


def test_body_identical_insertions_merge_once():
    assert three_way_body_merge("a\n", "x\na\n", "x\na\n") == "x\na\n"


def test_body_same_location_different_insertions_conflict():
    assert three_way_body_merge("a\n", "x\na\n", "y\na\n") is None

