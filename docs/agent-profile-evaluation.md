# Agent profile evaluation

This evaluates whether the default `agent` tool surface and its descriptions lead a planner toward the intended OpenSolar workflows. It does not test OpenSolar's API, and a single plan is not a deterministic score.

Date: 2026-09-23. Catalog under test: commit `184a547` (32-tool `agent` profile). No live org was called. Mutation cases were plans only.

## Method

Planners saw the tool name, the description copied from the server, and the server instruction. They did not see the preferred paths in `evals/agent-profile/cases.json`.

Environments:

| Planner | Where |
| --- | --- |
| Composer 2.5 | Cursor |
| Grok 4.6 | Cursor |

Claude Opus and GPT were not run. The other-model quota blocked those calls, and no Claude or ChatGPT CLI is installed on this machine.

A follow-up showed the same planners `list_projects`, `get_project`, `list_project_systems`, `get_system`, `list_workflows`, and `get_workflow` beside the semantic tools, for the lookup, snapshot, stage, and compare cases only.

Preferred path means the preferred tools appear in order, or an acceptable alternate does, and none of the tools listed as normally unnecessary were called. Extra calls that are not on that list still count as followed.

## Primary results

15 cases, two planners, 30 plans. Recorded calls are in `evals/agent-profile/runs/`.

Preferred-path rate: 28 of 30.

| Planner | Followed | Miss |
| --- | --- | --- |
| Composer 2.5 | 14 of 15 | `find-contact` also called `get_contact` |
| Grok 4.6 | 14 of 15 | `design-components` called `get_system_details` instead of `get_project_design` |

Median planned calls among the 14 followed plans: Composer 2, Grok 4.6 1.5. Composer's followed counts sorted are 0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 4, 5. Grok's are 0, 0, 1, 1, 1, 1, 1, 2, 2, 3, 4, 4, 6, 6.

Safety and ambiguity, counted separately from path misses:

- No plan guessed among multiple matches. Every Smith or Jane lookup set stop-if-ambiguous.
- No plan shared before preflight, or treated `unknown` as ready.
- No plan ranked a winning system.
- Read-only create: both planners made no write and did not substitute another mutation. Composer named the limitation with an empty call list. Grok did the same.
- API Access design: both planners treated `get_project_design` as absent. Neither invented component fields. Composer still called `get_project`, which cannot return the design.
- Grok's design miss avoided the unmapped section rather than filling it in.

## Overlap check

With the primitive tools visible, both planners still used `search_contacts`, `search_projects`, `get_project_snapshot`, `compare_project_systems`, and `update_project_stage` with `stage_name`. Neither paged `list_projects`, walked `list_workflows` / `get_workflow`, or rebuilt the comparison from `get_system`. 10 of 10 overlap plans followed the preferred path. Both still inserted `get_project` before the stage write.

## What changed

Profile membership did not change. The agent surface stays 32 tools. `full` stays 75. No full-only tool was required for these ordinary tasks, and no agent tool was unused in a way that showed it should leave the default surface. `list_projects` remains for browsing when there is no name or address to search.

Descriptions and the server instruction changed because both planners repeated the same extra reads:

- `get_org` said to confirm the org before writes. Both planners called it before mutations. That sentence is gone. A recheck of stage, share, and document generation no longer called `get_org`.
- The first server instruction required a get or list before every write. It now says a unique search match confirms the target, and more than one match means stop.
- `get_project` said to use it after `list_projects`. After the instruction change, both planners still called it before `update_project_stage`. The description now says a unique `search_projects` match does not need this call before a write. A recheck of the stage request then planned `search_projects` then `update_project_stage` on both planners, and both still stopped if Smith was ambiguous.

Those rechecks are later plans, not a replacement for the 28-of-30 rate above.

## Unresolved

Grok 4.6 once answered a design-components question with `get_system_details` because `get_project_design` says `components` is unmapped. Composer used `get_project_design` and noted the unmapped section. That split happened once, so the design wording was left as it is.

Composer once followed `search_contacts` with `get_contact` for an email lookup. The overlap rerun of the same request stopped at `search_contacts`. No description was added for that.

`list_projects` still says to call `get_project` for one project. With search available, neither planner paged the list for a named project, including when `list_projects` was on the catalog.
