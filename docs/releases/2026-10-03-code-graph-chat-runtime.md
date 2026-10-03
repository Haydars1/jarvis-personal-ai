# JARVIS Code Graph Chat Runtime — 2026-10-03

JARVIS repository intelligence is now connected to normal chat instead of existing only as a CI/developer tool.

## Behavior

When an authenticated JARVIS chat asks about repository impact, dependencies, dependency paths, symbols, or explicit Graphify/code-graph analysis, the Worker deterministically recognizes the intent and queues a read-only `code-graph-query` job for `Haydars1/jarvis-personal-ai`.

The existing GitHub-hosted cloud runner claims that job, shallow-clones the exact repository state, installs the pinned open-source Graphify CLI only when required, extracts a code-only graph, normalizes it through JARVIS's version-1 graph contract, and executes one of these operations:

- status
- find
- impact
- neighbors
- path

Completed jobs are formatted into readable Turkish graph results with repository files, symbols, paths, and impacted-file rankings. Ordinary chat does not create graph work.

## Runtime boundary

Graphify and Python remain outside the Cloudflare Worker runtime. The Worker only performs deterministic intent routing, D1 job queuing, and result presentation. Heavy graph extraction runs in the GitHub-hosted runner.

No hosted or paid Graphify account is required. The query consumer remains bound to the JARVIS-owned normalized schema, so the Graphify producer can still be replaced by a native producer later.

## Safety

The graph path is read-only. It does not add shell-command input, repository mutation, secret changes, device writes, vehicle actions, or automatic source-code modification.
