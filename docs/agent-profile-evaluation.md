# Default profile evaluation

This document records a small behavioral evaluation of the default `agent` profile. The goal is to verify that tool names, descriptions, and server instructions steer clients toward the intended MCP operations without requiring unnecessary primitive calls.

Date: 2026-09-23  
Profile: 32 tools  
Cases: 15

The evaluation does not test the OpenSolar API itself. API contracts and live verification are tracked separately.

## Method

Each case supplies a user task and the tool catalog visible to an MCP client. The expected path is defined in [`evals/agent-profile/cases.json`](../evals/agent-profile/cases.json).

A path passes when it:

- uses the preferred semantic tools, or an explicitly accepted equivalent;
- preserves ambiguity and mutation-safety rules;
- avoids primitive calls marked unnecessary for that case.

Recorded runs are stored under `evals/agent-profile/runs/`.

## Results

Across two independent planning runs, 28 of 30 primary cases followed the expected path.

The two deviations were conservative rather than unsafe:

- one contact lookup added a redundant detail read after a successful search;
- one design-components request used system details instead of the Raw Data design tool.

Safety behavior was consistent across the evaluated cases:

- ambiguous person/project matches were not guessed through;
- project sharing was not attempted before preflight;
- an `unknown` preflight result was not treated as ready;
- system comparisons did not choose a winner;
- read-only mode did not substitute a different mutation;
- unavailable Raw Data tools were not replaced with invented fields.

## Primitive-overlap check

A separate overlap check exposed both the semantic tools and lower-level list/detail primitives for project lookup, snapshots, workflow-stage changes, and system comparison.

All 10 overlap cases used the semantic path rather than reconstructing it from primitives. The checks covered:

- `search_contacts`;
- `search_projects`;
- `get_project_snapshot`;
- `compare_project_systems`;
- `update_project_stage` with `stage_name`.

## Resulting profile

The evaluation did not identify a reason to change profile membership.

The default profile remains 32 tools, while `full` exposes all 75 registered tools. `list_projects` remains useful for browsing when no name, address, email, or other search term is available.

## Known limitations

The evaluation is intentionally small and should not be interpreted as a benchmark score.

Two areas remain worth watching:

- design requests can overlap conceptually between `get_system_details` and `get_project_design`;
- a client may choose an extra detail read after a unique search result even when it is unnecessary.

Regression coverage for tool descriptions and server instructions remains the primary guard against changes in these paths.
