# Graph practice test contracts

Status: in verification; individual callable contracts are displayed with each problem and defined in `python-tools/suites.py`. Full-suite reference solutions have been exercised for router reachability and dependency ordering; the other graph exercises have not been independently verified.

## Scope and model

The graph exercises consume in-memory Python values, not persisted graph data. IDs are supplied by the caller and identify vertices within a single input. Directed flights may have parallel edges and cycles; train connections are directed and carry absolute departure and arrival times. Router links are directed by the sender's radius and exclude broken routers. Movie links are undirected, may contain duplicates and cycles, and ranking ties use ascending ID. Longest-path inputs are directed acyclic graphs including isolated vertices. Prerequisite pairs are directed, may repeat, and may contain cycles or self-loops. Grid regions use four-neighbor connectivity; boundary water is not a lake. Exact signatures, input restrictions and output shapes are in each exercise's test instructions.

## Observable behavior

- A sample run evaluates only the designated subset; a submission evaluates the full suite. Each case has a stable UUID derived from the problem ID and case name.
- A failed case reports the inputs, expected behavior and actual result or exception from the failing check. Cases accepting multiple answers describe the acceptance condition rather than asserting a single expected value. Timeouts and legacy submissions without recorded diagnostics are identified explicitly rather than inventing output.
- The testcase browser displays built-in inputs as structured JSON objects and accepts custom JSON objects with named fields. Graph inputs must preserve node identity and direction, including numeric IDs; represent adjacency and score mappings as arrays of pairs where JSON object keys would otherwise coerce IDs to strings. Custom cases run in the same sandbox as built-in cases. An optional JSON expected value compares against the JSON-normalized actual result; without one, the browser reports the result without judging it.
- Run evaluates the sample subset and custom cases without saving a submission. Submit evaluates only the authoritative full suite; custom cases never determine completion. Failures are accessible from the testcase browser. Existing submission history and saved drafts are preserved.
- Cases exercise applicable direction, disconnected components, cycles, ties, boundary values and duplicate relationships. Where multiple answers are valid, the tests accept any valid answer.
- The suite is a finite correctness check for local practice, not a proof of algorithmic complexity or correctness on every input. No graph data or graph-derived state is persisted; only submission code and verdicts are stored.
- Each case runs in a fresh restricted process. Isolation failure makes the request unavailable, not successful. These local, in-process test assertions are not a tamper-proof grading boundary.
