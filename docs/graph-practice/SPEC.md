# Graph practice test contracts

Status: in verification; individual callable contracts are displayed with each problem and defined in `python-tools/suites.py`. Full-suite reference solutions have been exercised for router reachability and dependency ordering; the other graph exercises have not been independently verified.

## Scope and model

The graph exercises consume in-memory Python values, not persisted graph data. IDs are supplied by the caller and identify vertices within a single input. Directed flights may have parallel edges and cycles; train connections are directed and carry absolute departure and arrival times. Router links are directed by the sender's radius and exclude broken routers. Movie links are undirected, may contain duplicates and cycles, and ranking ties use ascending ID. Longest-path inputs are directed acyclic graphs including isolated vertices. Prerequisite pairs are directed, may repeat, and may contain cycles or self-loops. Grid regions use four-neighbor connectivity; boundary water is not a lake. Exact signatures, input restrictions and output shapes are in each exercise's test instructions.

## Observable behavior

- A sample run evaluates only the designated subset; a submission evaluates the full suite. Each case has a stable UUID derived from the problem ID and case name.
- Cases exercise applicable direction, disconnected components, cycles, ties, boundary values and duplicate relationships. Where multiple answers are valid, the tests accept any valid answer.
- The suite is a finite correctness check for local practice, not a proof of algorithmic complexity or correctness on every input. No graph data or graph-derived state is persisted; only submission code and verdicts are stored.
- Each case runs in a fresh restricted process. Isolation failure makes the request unavailable, not successful. These local, in-process test assertions are not a tamper-proof grading boundary.
