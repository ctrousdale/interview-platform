"""JSON-compatible inputs for the canonical algorithm cases, in suite order."""

CANONICAL_INPUTS = {
    "algorithms-two-sum": [
        {"nums": [2, 7, 11, 15], "target": 9},
        {"nums": [3, 3], "target": 6},
        {"scenarios": [{"nums": [1, 2, 3], "target": 10}, {"nums": [], "target": 0}]},
        {"nums": [-4, 0, 4, 4], "target": 0},
    ],
    "algorithms-intervals": [
        {"intervals": [[1, 3], [2, 6], [8, 10], [15, 18]]},
        {"intervals": [[4, 5], [1, 4]]},
        {"intervals": [[4, 5], [1, 10], [2, 3], [1, 10]]},
        {"scenarios": [{"intervals": []}, {"intervals": [[2, 2], [-1, -1], [2, 3]]}]},
    ],
    "algorithms-cache": [
        {"capacity": 2, "operations": [["put", 1, 1], ["put", 2, 2], ["get", 1], ["put", 3, 3], ["get", 2], ["get", 3]]},
        {"capacity": 2, "operations": [["put", "a", 1], ["put", "b", 2], ["put", "a", 4], ["put", "c", 3], ["get", "a"], ["get", "b"]]},
        {"capacity": 0, "operations": [["put", 1, 2], ["get", 1]]},
        {"capacity": 1, "operations": [["put", 1, 0], ["get", 9], ["get", 1], ["put", 2, 5], ["get", 1], ["get", 2]]},
    ],
    "google-message-dedup": [
        {"messages": [[0, "x"], [59, "x"], [60, "x"]]},
        {"messages": [[5, "a"], [5, "b"], [5, "a"]]},
        {"messages": [[1, ""], [60, ""], [61, ""]]},
        {"messages": [[0, "a"], [60, "a"], [119, "a"], [120, "a"], [121, "a"], [180, "a"]]},
    ],
    "google-islands-lakes": [
        {"grid": [[1, 1, 1], [1, 0, 1], [1, 1, 1]]},
        {"grid": [[1, 0, 1], [0, 1, 0], [1, 0, 1]]},
        {"grid": [[1, 1, 1, 1, 1], [1, 0, 1, 0, 1], [1, 1, 1, 1, 1]]},
        {"scenarios": [{"grid": []}, {"grid": [[0, 0], [0, 0]]}, {"grid": [[1]]}]},
    ],
    "google-shift-timeline": [
        {"shifts": [["A", 1, 4], ["B", 2, 5]]},
        {"shifts": [["A", 1, 4], ["A", 2, 5], ["B", 5, 6]]},
        {"scenarios": [{"shifts": [["z", 5, 7], ["a", 1, 2]]}, {"shifts": []}]},
        {"shifts": [["b", 0, 2], ["a", 0, 2], ["b", 2, 4], ["a", 2, 4]]},
    ],
    "google-meeting-rooms": [
        {"intervals": [[0, 30], [5, 10], [15, 20]]},
        {"intervals": [[1, 2], [2, 3], [3, 4]]},
        {"intervals": [[1, 5], [1, 5], [1, 5]]},
        {"scenarios": [{"intervals": []}, {"intervals": [[5, 8], [0, 5], [3, 6], [6, 9]]}]},
    ],
    "google-cheapest-flights": [
        {"scenarios": [
            {"flights": [["A", "B", 100], ["B", "C", 100], ["A", "C", 500]], "source": "A", "destination": "C", "max_stops": 0},
            {"flights": [["A", "B", 100], ["B", "C", 100], ["A", "C", 500]], "source": "A", "destination": "C", "max_stops": 1},
        ]},
        {"scenarios": [
            {"flights": [["A", "B", 1]], "source": "B", "destination": "A", "max_stops": 2},
            {"flights": [], "source": "A", "destination": "A", "max_stops": 0},
        ]},
        {"flights": [["s", "a", 1], ["a", "b", 1], ["s", "b", 5], ["b", "t", 1]], "source": "s", "destination": "t", "max_stops": 1},
        {"scenarios": [
            {"flights": [["s", "a", 3], ["s", "a", 1], ["a", "s", 0], ["a", "t", 2], ["x", "t", 0]], "source": "s", "destination": "t", "max_stops": 3},
            {"flights": [["s", "a", 3], ["s", "a", 1], ["a", "s", 0], ["a", "t", 2], ["x", "t", 0]], "source": "t", "destination": "s", "max_stops": 3},
        ]},
    ],
    "google-train-schedule": [
        {"trains": [["a", "b", 1, 3], ["b", "c", 3, 5], ["a", "c", 1, 8]], "source": "a", "start_time": 0, "destination": "c"},
        {"scenarios": [
            {"trains": [["a", "b", 1, 2]], "source": "b", "start_time": 0, "destination": "a"},
            {"trains": [], "source": "a", "start_time": 7, "destination": "a"},
        ]},
        {"trains": [["a", "b", 0, 5], ["b", "c", 4, 6], ["b", "c", 5, 9], ["a", "c", 2, 8]], "source": "a", "start_time": 0, "destination": "c"},
        {"trains": [["a", "b", 1, 2], ["b", "a", 2, 3], ["a", "c", 1, 5], ["b", "c", 2, 5], ["x", "c", 0, 1]], "source": "a", "start_time": 0, "destination": "c"},
    ],
    "google-router-reachability": [
        {"scenarios": [
            {"routers": {"a": [0, 0, 5], "b": [3, 4, 0]}, "broken": [], "source": "a", "destination": "b"},
            {"routers": {"a": [0, 0, 5], "b": [3, 4, 0]}, "broken": [], "source": "b", "destination": "a"},
        ]},
        {"scenarios": [
            {"routers": {"a": [0, 0, 1], "b": [1, 0, 1], "c": [2, 0, 0]}, "broken": [], "source": "a", "destination": "c"},
            {"routers": {"a": [0, 0, 1], "b": [1, 0, 1], "c": [2, 0, 0]}, "broken": ["b"], "source": "a", "destination": "c"},
        ]},
        {"scenarios": [
            {"routers": {"a": [0, 0, 0]}, "broken": [], "source": "a", "destination": "a"},
            {"routers": {"a": [0, 0, 0]}, "broken": ["a"], "source": "a", "destination": "a"},
        ]},
        {"scenarios": [
            {"routers": {"a": [0, 0, 2], "b": [1, 0, 2], "c": [10, 0, 1], "d": [11, 0, 1]}, "broken": [], "source": "a", "destination": "d"},
            {"routers": {"a": [0, 0, 2], "b": [1, 0, 2], "c": [10, 0, 1], "d": [11, 0, 1]}, "broken": ["d"], "source": "c", "destination": "d"},
        ]},
    ],
    "google-top-k-similar": [
        {"graph": {"a": ["b", "c"], "b": ["a", "c"], "c": ["a", "b"]}, "scores": {"a": 99, "b": 4, "c": 4}, "start": "a", "k": 2},
        {"graph": [[1, [2]], [2, [1]], [3, []]], "scores": [[1, 0], [2, 1], [3, 10]], "start": 1, "k": 5},
        {"graph": [[1, [2, 2]], [2, [1, 3]], [3, [2, 4]], [4, [3]]], "scores": [[1, 0], [2, 2], [3, 9], [4, 5]], "start": 1, "k": 2},
        {"scenarios": [
            {"graph": [[1, []]], "scores": [[1, 0]], "start": 1, "k": 0},
            {"graph": [[1, []]], "scores": [[1, 0]], "start": 1, "k": 4},
        ]},
    ],
    "google-dag-longest-path": [
        {"graph": {"a": ["b", "c"], "b": ["d"], "c": [], "d": []}},
        {"graph": [[0, []], [1, [2]], [2, [3]], [3, []], [4, [5]], [5, []]]},
        {"graph": [[0, [1, 2]], [1, []], [2, []]]},
        {"scenarios": [{"graph": {}}, {"graph": {"x": []}}]},
    ],
    "google-dependency-order": [
        {"tasks": ["a", "b", "c", "d"], "prerequisites": [["a", "c"], ["b", "c"]]},
        {"tasks": ["a", "b"], "prerequisites": [["a", "b"], ["b", "a"]]},
        {"tasks": [1, 2, 3, 4], "prerequisites": [[1, 2], [1, 2], [2, 3]]},
        {"scenarios": [{"tasks": [1], "prerequisites": [[1, 1]]}, {"tasks": [], "prerequisites": []}]},
    ],
    "google-connect-sticks": [
        {"lengths": [2, 4, 3]},
        {"lengths": [1, 8, 3, 5]},
        {"scenarios": [{"lengths": []}, {"lengths": [7]}, {"lengths": [0, 0, 1]}]},
        {"lengths": [5, 5, 5, 5]},
    ],
    "google-string-transform": [
        {"scenarios": [{"source": "aabcc", "target": "ccdee"}, {"source": "aa", "target": "ab"}]},
        {"scenarios": [{"source": "ab", "target": "ba"}, {"source": "abc", "target": "abc"}]},
        {"scenarios": [
            {"source": "abcdefghijklmnopqrstuvwxyz", "target": "abcdefghijklmnopqrstuvwxyz"},
            {"source": "abcdefghijklmnopqrstuvwxyz", "target": "bcdefghijklmnopqrstuvwxyza"},
        ]},
        {"scenarios": [{"source": "", "target": ""}, {"source": "abc", "target": "bcd"}, {"source": "ab", "target": "cc"}]},
    ],
    "google-dynamic-intervals": [
        {"operations": [["book", 10, 20], ["book", 15, 25], ["book", 20, 30]]},
        {"operations": [["book", 1, 5], ["cancel", 1, 4], ["cancel", 1, 5], ["cancel", 1, 5], ["book", 1, 5]]},
        {"operations": [["book", 3, 7], ["book", 1, 9], ["book", 4, 5], ["book", 3, 7]]},
        {"operations": [["book", 0, 2], ["book", 4, 6], ["book", 2, 4], ["cancel", 2, 4], ["book", 2, 4]]},
    ],
}
