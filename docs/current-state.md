# Current implementation

Snapshot of what this package actually ships today, as distinct from
contributor plans in `dev-docs/`. Use this file when comparing later
architecture work against the walking skeleton.

Last reviewed: 2026-09-23

---

## Baseline

| Item | Value |
|------|-------|
| Package | `@alignco/opensolar-mcp` `0.1.0-rc.1` |
| Branch | `main` |
| Node | `>=24` (`.nvmrc` is `24`) |
| Module | ESM (`"type": "module"`) |
| Package manager | pnpm |
| License | MIT (`LICENSE`; copyright Align Software Company 2026) |
| README | Release-facing guide with quick start, profiles, transport authentication, Docker, upload confinement, safety notes, and documentation links. |

The annotated tag `pre-rebase-baseline` still points at the earlier
walking-skeleton snapshot. The documented native inventory is now paired
with agent-oriented search, project snapshots, stage-name resolution,
system comparison, design projections, share preflight, bounded read
retries, live-contract checks, agent/full exposure profiles, and release
artifact smoke tests.

---

## Package and toolchain

Runtime dependencies:

| Package | Range in `package.json` |
|---------|-------------------------|
| `@modelcontextprotocol/server` | `^2.0.0` |
| `@modelcontextprotocol/hono` | `^2.0.0` |
| `@hono/node-server` | `^2.1.1` |
| `hono` | `^4.13.8` |
| `zod` | `^4.4.3` |
| `unpdf` | `^1.8.1` |

Dev dependencies include `@modelcontextprotocol/client` `^2.0.0` (protocol
tests), `@types/node` `^24`, vitest, tsup, tsx, biome, typescript.

Scripts:

| Script | Command |
|--------|---------|
| `dev` | `tsx src/index.ts` |
| `dev:http` | `tsx src/index.ts --http` |
| `build` | `tsup` (`target: node24`) |
| `typecheck` | `tsc --noEmit` |
| `lint` | `biome check .` |
| `format` | `biome format --write .` |
| `test` | vitest smoke, protocol, and CLI tests (no live token) |
| `test:integration` | live org GET when `.env.local` has credentials |
| `check:all` | lint + typecheck + test |

Binary: `opensolar-mcp` → `./dist/index.js`.

---

## Architecture record

Accepted decisions (local `dev-docs/decisions/`):

| ADR | Decision | Wired in code today |
|-----|----------|---------------------|
| 001 Dual transport | One binary, stdio default, `--http` / `MCP_TRANSPORT=http` for Streamable HTTP | `buildServer()` feeds `serveStdio` and `createMcpHandler`. HTTP is stateless; `/health` and `/ready` sit outside `/mcp`. |
| 002 Tier-policy as data | `src/lib/tier-policy.ts` is the only policy table | `selectTools` and `--list-tools` read it. No live plan detection yet. |
| 003 No frontend | No web UI | Held. |
| 004 BYO-token | Request or local-process credential; no OAuth; no persistence | Stdio and `--check` require `OPENSOLAR_API_TOKEN`. Loopback HTTP accepts a request Bearer token then the env token as fallback. Non-loopback HTTP requires `Authorization: Bearer <token>` on each MCP request and ignores the env fallback. |
| 005 Redaction scope | Keep surgical + wholesale redaction | `src/lib/redaction.ts` is used by org, project, contact, and role paths. |

Env vars: `OPENSOLAR_API_TOKEN`, `OPENSOLAR_ORG_ID`, `OPENSOLAR_BASE_URL`,
`OPENSOLAR_PROFILE`, `OPENSOLAR_TOOLSETS`, `OPENSOLAR_READ_ONLY`, `OPENSOLAR_PLAN`,
`OPENSOLAR_UPLOAD_ROOT`, `MCP_TRANSPORT`, `MCP_HTTP_HOST`, `MCP_HTTP_PORT`, `MCP_HTTP_PATH`,
`MCP_HTTP_ALLOWED_HOSTS`. Live tests also read
`OPENSOLAR_INTEGRATION_WRITES`, `OPENSOLAR_TEST_PROJECT_ID`, and
`OPENSOLAR_TEST_CONNECTED_ORG_ID`. Those three are not server settings.

---

## Transports and CLI

| Surface | Status | Location |
|---------|--------|----------|
| Stdio | Implemented | `src/transports/stdio.ts` (`serveStdio`) |
| Streamable HTTP | Implemented, stateless | `src/transports/http.ts` (`createMcpHandler` + Hono) |
| `--check` | Implemented | `src/cli/check.ts` (optional `--no-probe`) |
| `--list-tools` | Implemented | `src/cli/list-tools.ts` (registration order, not sorted) |
| `--help` | Implemented | `src/cli/help.ts` |
| `--http` / bind / path | Implemented | `src/lib/config.ts` + `src/transports/http.ts` |
| Dockerfile | Implemented | Node 24 image, `CMD --http`, healthcheck on `/health`. Default bind stays loopback. |

MCP server identity: name `@alignco/opensolar-mcp`, version read from `package.json` (`0.1.0-rc.1`).
The server advertises tools only (no empty resources/prompts handlers).

Server instructions are five lines in `src/lib/server-instructions.ts`:
read before mutate, a unique search match confirms the target, one page
per list call, access-plan omissions, do not invent IDs or simulate bulk
work by looping mutation calls, and do not open repository files for
OpenSolar answers. A documented bulk operation is used only when the MCP
exposes it. `share_entities` is that case.

---

## Tool inventory

Registration: `src/tools/index.ts` registers toolsets in this order:
`projects`, `org`, `contacts`, `events`, `systems`, `components`,
`workflow`, `payment`, `pricing`, `costing`, `reference`, `files`,
`webhooks`, `teams`, `raw_data`. Exposure is `agent` or `full_only` on
`TIER_POLICY`. Absent `OPENSOLAR_PROFILE` selects `agent`. `full` keeps
every registered tool. An explicit `OPENSOLAR_TOOLSETS` list overrides
profile membership. `OPENSOLAR_READ_ONLY` and `OPENSOLAR_PLAN` still apply.
`OPENSOLAR_PLAN=api_access` omits `get_proposal_data` and `get_project_design`.

Tool kind is separate from evidence. `native` is one documented OpenSolar
operation. `safe_wrapper` adds MCP-side checks around one operation;
`update_project_stage` is that kind because a stage title is resolved
before the documented PATCH. `derived` is local logic over documented
reads: `search_projects`, `search_contacts`, `compare_project_systems`,
`get_project_design`, and `preflight_project_share`. `composite` joins
several reads: `get_project_snapshot`. `static_reference` is a copied
docs table with no HTTP call. `unsupported` means the request contract
is not established well enough to register. On 2026-09-22, a live verification org
live-checked `search_contacts`, `search_projects`, `get_project_snapshot`,
`compare_project_systems`, and the mapped `get_project_design` sections.
`preflight_project_share` was skipped because
`OPENSOLAR_TEST_CONNECTED_ORG_ID` was unset. `update_project_stage` stays
documented and was not live-checked because no dedicated fixture project
was configured. A phone-only contact PUT on a disposable fixture kept
`first_name`, `family_name`, and `email`, so `update_contact` still sends
only the supplied supported fields.

Every registered tool has `title`, a short description, `outputSchema`,
and `openWorldHint`, and returns `structuredContent` plus a one-line
text summary. Reads set `readOnlyHint: true`. Creates and updates set
`readOnlyHint: false`. Deletes also set `destructiveHint: true`.
`OPENSOLAR_READ_ONLY=1` omits every registered mutation and keeps the reads.
Errors return `isError: true` with no `structuredContent`.

| Tool | Toolset file | `TIER_POLICY` | HTTP | Status |
|------|--------------|---------------|------|--------|
| `list_projects` | `src/tools/projects.ts` | `api_access`, read | `GET orgs/:org_id/projects/?limit=&page=` | Implemented |
| `search_projects` | `src/tools/projects.ts` | `api_access`, read | `GET orgs/:org_id/projects/?page=&limit=100` | Implemented |
| `get_project` | `src/tools/projects.ts` | `api_access`, read, `degradesWith: ['design']` | `GET orgs/:org_id/projects/:id/` | Implemented |
| `get_project_snapshot` | `src/tools/projects.ts` | `api_access`, read | project, workflow, systems list, and file metadata | Implemented |
| `create_project` | `src/tools/projects.ts` | `api_access`, mutation | `POST orgs/:org_id/projects/` | Implemented |
| `update_project` | `src/tools/projects.ts` | `api_access`, mutation | `PATCH orgs/:org_id/projects/:id/` | Implemented |
| `update_project_stage` | `src/tools/projects.ts` | `api_access`, mutation | `PATCH orgs/:org_id/projects/:id/` | Implemented |
| `update_project_usage` | `src/tools/projects.ts` | `api_access`, mutation | `PATCH orgs/:org_id/projects/:id/` | Implemented |
| `delete_project` | `src/tools/projects.ts` | `api_access`, mutation | `DELETE orgs/:org_id/projects/:id/` | Implemented |
| `get_org` | `src/tools/org.ts` | `api_access`, read | `GET orgs/:org_id/` | Implemented |
| `list_roles` | `src/tools/org.ts` | `api_access`, read | `GET orgs/:org_id/roles/` | Implemented |
| `get_role` | `src/tools/org.ts` | `api_access`, read | `GET orgs/:org_id/roles/:id/` | Implemented |
| `list_contacts` | `src/tools/crm.ts` | `api_access`, read | `GET orgs/:org_id/contacts/?page=&limit=&ordering=` | Implemented |
| `search_contacts` | `src/tools/crm.ts` | `api_access`, read | `GET orgs/:org_id/contacts/?page=&limit=100` | Implemented |
| `get_contact` | `src/tools/crm.ts` | `api_access`, read | `GET orgs/:org_id/contacts/:id/` | Implemented |
| `create_contact` | `src/tools/crm.ts` | `api_access`, mutation | `POST orgs/:org_id/contacts/` | Implemented |
| `update_contact` | `src/tools/crm.ts` | `api_access`, mutation | `PUT orgs/:org_id/contacts/:id/` | Implemented |
| `delete_contact` | `src/tools/crm.ts` | `api_access`, mutation | `DELETE orgs/:org_id/contacts/:id/` | Implemented |
| `get_event` | `src/tools/events.ts` | `api_access`, read | `GET orgs/:org_id/events/:event_id/` | Implemented |
| `list_event_types` | `src/tools/events.ts` | `api_access`, read | none (copied docs table) | Implemented |
| `list_project_systems` | `src/tools/systems.ts` | `api_access`, read | `GET orgs/:org_id/systems/?fieldset=list&project=&page=&limit=` | Implemented |
| `compare_project_systems` | `src/tools/systems.ts` | `api_access`, read | systems list, then one system-details call when a listed system is missing a hardware group | Implemented |
| `get_system` | `src/tools/systems.ts` | `api_access`, read | `GET orgs/:org_id/systems/:id/?fieldset=list` | Implemented |
| `get_system_details` | `src/tools/systems.ts` | `api_access`, read, `degradesWith: ['custom_data']` | `GET orgs/:org_id/projects/:project_id/systems/details/` | Implemented |
| `get_system_image` | `src/tools/systems.ts` | `api_access`, mutation | `GET orgs/:org_id/projects/:project_id/systems/:uuid/image/?width=&height=` | Implemented |
| `list_modules` | `src/tools/components.ts` | `api_access`, read | `GET orgs/:org_id/component_module_activations/?page=&limit=` | Implemented |
| `get_module` | `src/tools/components.ts` | `api_access`, read | `GET orgs/:org_id/component_module_activations/:id/` | Implemented |
| `delete_module_activation` | `src/tools/components.ts` | `api_access`, mutation | `DELETE orgs/:org_id/component_module_activations/:id/` | Implemented |
| `list_inverters` | `src/tools/components.ts` | `api_access`, read | `GET orgs/:org_id/component_inverter_activations/?page=&limit=` | Implemented |
| `get_inverter` | `src/tools/components.ts` | `api_access`, read | `GET orgs/:org_id/component_inverter_activations/:id/` | Implemented |
| `delete_inverter_activation` | `src/tools/components.ts` | `api_access`, mutation | `DELETE orgs/:org_id/component_inverter_activations/:id/` | Implemented |
| `list_batteries` | `src/tools/components.ts` | `api_access`, read | `GET orgs/:org_id/component_battery_activations/?page=&limit=` | Implemented |
| `get_battery` | `src/tools/components.ts` | `api_access`, read | `GET orgs/:org_id/component_battery_activations/:id/` | Implemented |
| `delete_battery_activation` | `src/tools/components.ts` | `api_access`, mutation | `DELETE orgs/:org_id/component_battery_activations/:id/` | Implemented |
| `list_other_components` | `src/tools/components.ts` | `api_access`, read | `GET orgs/:org_id/component_other_activations/?page=&limit=` | Implemented |
| `get_other_component` | `src/tools/components.ts` | `api_access`, read | `GET orgs/:org_id/component_other_activations/:id/` | Implemented |
| `delete_other_component_activation` | `src/tools/components.ts` | `api_access`, mutation | `DELETE orgs/:org_id/component_other_activations/:id/` | Implemented |
| `list_workflows` | `src/tools/workflow.ts` | `api_access`, read | `GET orgs/:org_id/workflows/?page=&limit=` | Implemented |
| `get_workflow` | `src/tools/workflow.ts` | `api_access`, read | `GET orgs/:org_id/workflows/:id/` | Implemented |
| `create_workflow` | `src/tools/workflow.ts` | `api_access`, mutation | `POST orgs/:org_id/workflows/` | Implemented |
| `delete_workflow` | `src/tools/workflow.ts` | `api_access`, mutation | `DELETE orgs/:org_id/workflows/:id/` | Implemented |
| `list_payment_options` | `src/tools/payment.ts` | `api_access`, read | `GET orgs/:org_id/payment_options/?page=&limit=` | Implemented |
| `get_payment_option` | `src/tools/payment.ts` | `api_access`, read | `GET orgs/:org_id/payment_options/:id/` | Implemented |
| `delete_payment_option` | `src/tools/payment.ts` | `api_access`, mutation | `DELETE orgs/:org_id/payment_options/:id/` | Implemented |
| `list_pricing_schemes` | `src/tools/pricing.ts` | `api_access`, read | `GET orgs/:org_id/pricing_schemes/?page=&limit=` | Implemented |
| `get_pricing_scheme` | `src/tools/pricing.ts` | `api_access`, read | `GET orgs/:org_id/pricing_schemes/:id/` | Implemented |
| `delete_pricing_scheme` | `src/tools/pricing.ts` | `api_access`, mutation | `DELETE orgs/:org_id/pricing_schemes/:id/` | Implemented |
| `list_costings` | `src/tools/costing.ts` | `api_access`, read | `GET orgs/:org_id/costings/?page=&limit=` | Implemented |
| `get_costing` | `src/tools/costing.ts` | `api_access`, read | `GET orgs/:org_id/costings/:id/` | Implemented |
| `delete_costing` | `src/tools/costing.ts` | `api_access`, mutation | `DELETE orgs/:org_id/costings/:id/` | Implemented |
| `list_roof_types` | `src/tools/reference.ts` | `api_access`, read | none (copied docs table) | Implemented |
| `list_file_tags` | `src/tools/reference.ts` | `api_access`, read | none (copied docs table) | Implemented |
| `list_private_files` | `src/tools/files.ts` | `api_access`, read | `GET orgs/:org_id/private_files/?page=&limit=` | Implemented |
| `get_private_file` | `src/tools/files.ts` | `api_access`, read | `GET orgs/:org_id/private_files/:id/` | Implemented |
| `create_private_file` | `src/tools/files.ts` | `api_access`, mutation | `POST orgs/:org_id/private_files/` (multipart) | Implemented |
| `update_private_file` | `src/tools/files.ts` | `api_access`, mutation | `PATCH orgs/:org_id/private_files/:id/` | Implemented |
| `delete_private_file` | `src/tools/files.ts` | `api_access`, mutation | `DELETE orgs/:org_id/private_files/:id/` | Implemented |
| `generate_project_document` | `src/tools/files.ts` | `api_access`, mutation | `POST orgs/:org_id/projects/:project_id/generate_document/:type/?action=save` (pdf and docx use the `_pdf` and `_docx` paths) | Implemented |
| `list_webhooks` | `src/tools/webhooks.ts` | `api_access`, read | `GET orgs/:org_id/webhooks/` | Implemented |
| `create_webhook` | `src/tools/webhooks.ts` | `api_access`, mutation | `POST orgs/:org_id/webhooks/` | Implemented |
| `update_webhook` | `src/tools/webhooks.ts` | `api_access`, mutation | `PATCH orgs/:org_id/webhooks/:id/` | Implemented |
| `list_webhook_logs` | `src/tools/webhooks.ts` | `api_access`, read | `GET orgs/:org_id/webhook_process_logs/?page=&limit=` | Implemented |
| `list_webhook_queue` | `src/tools/webhooks.ts` | `api_access`, read | `GET orgs/:org_id/webhook_queue_models/?page=&limit=` | Implemented |
| `list_connected_orgs` | `src/tools/teams.ts` | `api_access`, read | `GET orgs/:org_id/connected_orgs/?fieldset=list&page=&limit=` | Implemented |
| `preflight_project_share` | `src/tools/teams.ts` | `api_access`, read | connected orgs, project detail, systems list | Implemented |
| `list_connection_requests` | `src/tools/teams.ts` | `api_access`, read | `GET orgs/:org_id/connected_orgs/pending/` | Implemented |
| `create_connection_request` | `src/tools/teams.ts` | `api_access`, mutation | `POST orgs/:org_id/connected_orgs/` | Implemented |
| `accept_connection_request` | `src/tools/teams.ts` | `api_access`, mutation | `POST orgs/:org_id/connected_orgs/accept_connection/` | Implemented |
| `update_connection` | `src/tools/teams.ts` | `api_access`, mutation | `PATCH orgs/:org_id/connected_orgs/:id/` | Implemented |
| `delete_connection` | `src/tools/teams.ts` | `api_access`, mutation | `DELETE orgs/:org_id/connected_orgs/:id/` | Implemented |
| `share_project` | `src/tools/teams.ts` | `api_access`, mutation | `PUT orgs/:org_id/projects/:id/` | Implemented |
| `share_entities` | `src/tools/teams.ts` | `api_access`, mutation | `PUT orgs/:org_id/bulk/:entity_type/` | Implemented |
| `create_permission_role` | `src/tools/teams.ts` | `api_access`, mutation | `POST orgs/:org_id/permissions_role/` | Implemented |
| `get_proposal_data` | `src/tools/raw-data.ts` | `raw_data`, read | `GET user_logins/?project_ids=` | Implemented |
| `get_project_design` | `src/tools/raw-data.ts` | `raw_data`, read | `GET orgs/:org_id/projects/:id/` | Implemented |

75 tools are registered. `preflight_project_share` checks a connection and a project share without writing. A resource share of `unknown` is not treated as safe. `compare_project_systems` returns only the columns each system payload has and does not rank a winner. `get_project_snapshot` joins one project with its workflow, systems, and file metadata. A failed section is a gap. `search_projects` and `search_contacts` page the documented lists and match locally. They do not send a `search` query. OpenSolar does not document those MCP tools. Nine writes from the documented inventory are
not registered, because their request contracts are not established with sufficient confidence:
`create_module_activation`, `create_inverter_activation`,
`create_battery_activation`, `create_other_component_activation`,
`create_pricing_scheme`, `create_payment_option`, `create_costing`,
`update_workflow`, and `update_org`. There is no webhook delete. The
public release checklist is not done.

Shipped extras on implemented tools (not extra HTTP parameters):

- `verbose` on `list_projects`, `get_project`, `get_org`
- curated vs redacted payloads
- `is_synthetic_email` on contacts
- `event_type_name` on events / curated project events
- `design_available` and curated `events` on `get_project`

### Curation and workflow stage

`list_projects` always returns `{ projects, page, limit }`. Default
`projects` rows are curated: `id`, `title`, `address`, `created_date`,
`modified_date`, deprecated `stage`, `stage_milestone` when the numeric
stage is known, and `workflow` (`workflow_id`, `active_stage_id`) when
OpenSolar sent those ids. That default list cannot include nested
passport or licence fields. `verbose: true` puts full redacted list
objects in `projects`.

`get_project` default curated output includes `id`, `title`, `address`,
`locality`, `state`, `zip`, `country_iso2`, `lat`, `lon`, deprecated
`stage`, `stage_milestone`, `workflow` (`workflow_id`, `active_stage_id`)
when present, `contacts`, `system_count`, `assigned_role_data`,
`design_available`, curated `events`, `created_date`, and
`modified_date`. `verbose: true` returns the full redacted project;
compressed `design` is `[REDACTED]`, not the gzip blob.

`list_contacts` returns `{ contacts }`. Upstream is still a bare array.

Phase 2 lists return one curated page (`page` and `limit`, default 20,
maximum 100) except `list_roles` (no query) and the three local tables
(the whole copied table, no HTTP). Detail reads return one curated
object. Omitted on the default path: workflow stage actions, role
`api_key_chat`, component `data`, payment and pricing `configuration_json`,
and costing per-unit rates. `get_role` sends `fieldset=list` only when
that input is set. `get_system_details` uses a 120 second timeout, a
default `include_parts` list, and rejects a call that sets both
`include_parts` and `exclude_parts`. `list_event_types`, `list_roof_types`,
and `list_file_tags` do not call OpenSolar. File tags are titles only.

`list_private_files` returns `{ private_files, page, limit }`. Each row
is `id`, `title`, file-tag titles, and `project_id`. `get_private_file`
adds `size` and `content_type` when present. `include_contents: true`
downloads the file on the server. Text copied into structured output is
capped at 100,000 characters. Images use MCP image blocks; PDFs include
extracted text plus an embedded `application/pdf` resource; other binary
files use embedded resources. Binary bytes are not duplicated into
`structuredContent`. A body over 10 MB is `isError`, and the signed
download URL is never returned. `create_private_file` is disabled unless
`OPENSOLAR_UPLOAD_ROOT` is configured; relative and absolute paths are
accepted only when their resolved real path remains inside that root,
including through symlinks. It streams multipart `file_contents`.
`update_private_file` sends `{ title }`. `delete_private_file` and
`generate_project_document` return `{ id, deleted: true }` and `{ id }`
respectively. `generate_project_document` does not return bytes.
`get_system_image` requires `width` and `height`, uses a 120 second
timeout, and returns `id` only when the response exposes a private file
id, plus `content_type`. Requested image bytes are returned as MCP image
content, not duplicated into structured output. `OPENSOLAR_READ_ONLY=1`
omits it.

`list_webhooks` returns `{ webhooks }` with no page parameters. Each
webhook is `id`, `endpoint`, `enabled`, `debug`, `trigger_fields`, and
`payload_fields`. `headers` is not accepted and is not returned.
`create_webhook` requires `endpoint`, `enabled`, and `debug`. Unset
`trigger_fields` and `payload_fields` are omitted so OpenSolar applies
its defaults. `update_webhook` sends only the fields that were set.
`list_webhook_logs` and `list_webhook_queue` return one curated page.
Log rows are `id`, `webhook_id`, `event_queue_name`, `created_date`,
`modified_date`, and `event_timestamp`. Queue rows use `next_attempt_at`
and `processing_started_at` for the timestamps. Delivery notes and
queue attempt fields are omitted. The fair-use ceiling is 2,000 webhook
events a month. The server does not count them. A derived webhook
diagnostic is not a public tool. Those three reads are the documented
surface. The logs page does not define a health rule a new tool could
apply without inventing one.

`list_connected_orgs` returns `{ connected_orgs, page, limit }`. Each
connection is `id`, `org_name`, `partner_org_id`, `permission_role_id`,
`notify_roles`, `is_active`, `is_other_active`, and `is_other_enabled`.
`list_connection_requests` returns `{ connection_requests }` with
`item_id`, `org_from_id`, `org_from_name`, and `org_to_id`.
`create_connection_request` requires `org_name`. A permission role id is
turned into the role URL. `update_connection` sends `is_active`.
`delete_connection` returns `{ id, deleted: true }`. `share_project`
sends one `shared_with` entry. `share_entities` sends `resource` as the
same value as `entity_type`. `create_permission_role` sends `role_type`
1 and the page's permission keys as a JSON string. Connected-org calls
are limited to 100 a day per user and per org. The server does not
count them.

`preflight_project_share` takes `project_id` and `target_org_id`. It
reads up to three connected-org pages, the project, and one systems
page. It does not call `share_project` or `share_entities`. `connection`
is `ready` only when the scan finishes and one match has `is_active`,
`is_other_active`, and `is_other_enabled` all true. A false flag is
`not_ready`. An unfinished scan is `unknown`, not `not_connected`.
`project_share` uses `shared_with` on the project. Payment option,
pricing scheme, costing, and module activation rows carry ids when the
documented payload has them. Those ids are checked with
`fieldset=list` and `shared_with` set to the target org, at most three
pages. Every referenced id in a finished filtered list is `shared`.
None of them is `not_shared`. A mix is `partially_shared`, with
`shared_ids` and `missing_share_ids`. An unfinished filtered scan is
`unknown` and does not treat an unseen id as missing. Inverter, battery,
and other activation ids stay `unknown` because the systems list example
does not name those keys. `unknown` is not safe to share.

`get_proposal_data` takes one `project_id` and calls
`GET user_logins/?project_ids=`. Compressed JSON expansion is capped at
64 MB before parsing. It returns system name, annual kWh,
monthly kWh, payback year, net present value, IRR, and return on
investment. A compressed `output` string is decoded before those numbers
are read. Design blobs, panel coordinates, pricing objects, and the
compressed strings are omitted. The proposal page does not list keys
inside `data.pricing`, `line_items`, or `payment_options`. HTTP 402
means Raw Data API Access is missing.

`get_project_design` reads `design` from `GET orgs/:org_id/projects/:id/`.
A missing or null design returns `{ design_available: false }`. A present
design is gunzipped with a 64 MB maximum decompressed output before JSON
parsing. `section` defaults to `summary`: `system_count` and
`system_price_including_tax`. `components` and `energy` return
`unmapped: true` because the decompress section still does not name those
keys. `geometry` reports whether `autoFacetsGeoJson` is present and does
not return coordinates. `financials` returns numeric pricing keys found on
each system object and does not return pricing objects. The compressed
string is not returned. HTTP 402 still means Raw Data API Access is
missing. `get_project` verbose still replaces `design` with `[REDACTED]`.

`compare_project_systems` takes one `project_id`. It reads one systems
list page. kWh per kW and price per watt are calculated only when both
inputs are present and kW is greater than zero. A column that is absent
on that system is omitted. One system-details call runs when a listed
system is missing one or more of modules, inverters, or batteries. An
empty array counts as present. Details fills only the missing groups and
does not replace a group the list already sent. A failed details call sets
`hardware_gap` and still returns the list columns. No system is ranked.

See [api-contract-matrix.md](./api-contract-matrix.md).

---

## Client capabilities

[`src/client/index.ts`](../src/client/index.ts):

- GET, POST, PUT, PATCH, and DELETE share one request path
- POST, PUT, and PATCH send JSON. DELETE sends no body. Writes are not retried
- `postForm` sends multipart and does not set `Content-Type`
- `download` fetches a signed media URL with no API bearer and refuses a body over 10 MB
- `getFile` follows redirects on an API path, keeps the bearer, and does not return the final URL
- A non-GET path that does not already end in `/` gets one trailing slash
- `resourceUrl` builds an absolute URL from the configured base URL
- 30s timeout via `AbortSignal.timeout`; a call may pass `timeoutMs` (`get_system_details` and `get_system_image` use 120s); timeout becomes HTTP 504
- `Authorization: Bearer` from the resolved token
- Throws `OpenSolarApiError` with status and body text on non-OK
- Parses JSON; empty body → `null`
- Base URL from config, trailing slash normalized

Present:

- `src/client/auth.ts` — exact Bearer parsing; request header takes precedence, loopback HTTP may fall back to env, non-loopback HTTP may not
- `src/client/errors.ts` — sanitized 401/402/403/404/429/504 tool messages;
  `openSolarSuccess` / `runOpenSolarTool`

Not present as modules (planned in `dev-docs/directory.md`):

- `src/client/tier.ts` — no live plan detection
- `src/client/pagination.ts` — tools build query strings themselves
- `src/client/rate-limit.ts` — not a module. Bounded 429 retry for ordinary JSON GET lives in `src/client/index.ts`.

Config: [`src/lib/config.ts`](../src/lib/config.ts). Zod-validated.
Stdio and `--check` fail if token or org id is missing. HTTP requires
org id at startup. Loopback HTTP may use the env token; non-loopback
HTTP returns 401 unless each MCP request carries a valid Bearer-shaped
OpenSolar token. Host allowlisting is separate from authentication.

Logging: [`src/lib/log.ts`](../src/lib/log.ts) writes JSON lines to stderr
for every level so stdio stdout stays protocol-clean.

---

## Schema inventory

| File | Role |
|------|------|
| `src/schemas/project.ts` | `ProjectSummarySchema` (list is a bare array), `ProjectFullSchema`, `curateProject`, `curateProjectListRow`, list/get output schemas, write results `{ id, address }`, stage ids, usage source, and `{ id, deleted: true }` |
| `src/schemas/contact.ts` | `ContactSchema` (`id`, `email`, passthrough), four-field write allowlist, list as array, `{ contacts }` output schema |
| `src/schemas/event.ts` | `EventSchema`, `curateProjectEvent` |
| `src/schemas/org.ts` | `OrgSchema`, `curateOrg` |
| `src/schemas/role.ts` | `RoleSchema`, `curateRole`, `{ roles }` output |
| `src/schemas/system.ts` | system list, detail, and system-details curation |
| `src/schemas/workflow.ts` | `curateWorkflow`; stages omit actions |
| `src/schemas/component.ts` | activation row shared by modules, inverters, batteries, and other components |
| `src/schemas/payment.ts` | payment option row; `configuration_json` omitted |
| `src/schemas/pricing.ts` | pricing scheme row; `configuration_json` omitted |
| `src/schemas/costing.ts` | costing row; per-unit rates omitted |
| `src/schemas/private-file.ts` | private-file row, contents, and generated-document `{ id }` |
| `src/schemas/webhook.ts` | webhook, log, and queue rows |
| `src/schemas/proposal.ts` | curated proposal figures |
| `src/schemas/design.ts` | decoded design summary |
| `src/schemas/team.ts` | connected org, pending request, share, and permission role rows |

Related libraries: `src/lib/redaction.ts`, `src/lib/contact-enrich.ts`,
`src/lib/file-contents.ts`, `src/lib/gzip-json.ts`, `src/lib/enums/event-types.ts`,
`src/lib/enums/roof-types.ts`, `src/lib/enums/file-tags.ts`,
`src/lib/enums/document-types.ts`, `src/lib/enums/webhook-fields.ts`,
`src/lib/enums/share-entities.ts`, `src/lib/enums/team-permissions.ts`.

---

## Build baseline log

`pnpm test` never reads `.env.local` and never calls OpenSolar.
`pnpm test:integration` loads gitignored `.env.local` (or
`dev-docs/private/.env.local`). Credentials alone run read-only live
checks: the org, an event from project `events_data`, contact
`ordering`, and the agent-oriented reads (`search_contacts`,
`search_projects`, `get_project_snapshot`, `compare_project_systems`,
and `get_project_design` when Raw Data is present). Writes run only when
`OPENSOLAR_INTEGRATION_WRITES=1`. A stage change also requires
`OPENSOLAR_TEST_PROJECT_ID`. Share preflight requires
`OPENSOLAR_TEST_CONNECTED_ORG_ID`. CI runs `pnpm check:all`, builds the
bundle, checks the built CLI, packs the npm artifact, installs it into a
clean temporary project, and runs stdio/HTTP artifact smoke tests. The
release smoke also verifies non-loopback HTTP requires a per-request
Bearer token and scans all supported local env locations for tokens
without printing them. CI does not set OpenSolar credentials or the
write flag. `tests/integration` stays out of `check:all`.

---

## Planned vs built

`dev-docs/plan/v1-2026-09-22.md` is the shipped native inventory, not
the current work order. Agent-oriented Batches A–D are in the tree.
`dev-docs/tools-roadmap.md` is historical (it still describes a 19-tool
cut). The registered surface is that native inventory plus the derived
and composite tools named above.

| Plan said | Code today |
|-----------|------------|
| HTTP transport | Stateless Streamable HTTP via `createMcpHandler` |
| `--check` / `--list-tools` | Implemented |
| Tool titles, `outputSchema`, `structuredContent` | Implemented for the registered reads and writes |
| Documented inventory | 75 tools registered, including derived `search_projects`, `search_contacts`, `compare_project_systems`, and `preflight_project_share`, and composite `get_project_snapshot`. Nine writes stay unsupported until their request contracts are established with sufficient confidence. Absence of an example request alone does not decide that. The public release checklist is not done. |
| `OPENSOLAR_TOOLSETS` / `OPENSOLAR_READ_ONLY` / `OPENSOLAR_PROFILE` | Read at registration. Default profile is `agent` (32 tools with Raw Data, before read-only and plan filters). `full` is the 75-tool surface. An explicit `OPENSOLAR_TOOLSETS` list overrides profile membership. |
| Client GET timeout | Implemented (30s default; per-call override) |
| Client auth / errors | Present |
| Client GET 429 retry | Ordinary JSON `get()` retries at most three attempts. Wait is `Retry-After` when it is at most 5 seconds, otherwise 200 ms then 400 ms. A longer `Retry-After` is returned as 429 with no sleep. POST, PUT, PATCH, DELETE, `postForm`, `getFile`, and `download` are not retried. There is no quota store. |
| POST/PUT/PATCH/DELETE client | Implemented. Writes are one attempt |
| vitest, `pnpm test`, CI | Present; CI on Node 24 with pnpm 10 |
| README + LICENSE | Present |
| Dockerfile | Present (user-owned `--http` deploy) |
| Hosted multi-customer server | Not built |
| User docs (`authentication.md`, `tiers.md`, `tools.md`, …) | Not in this repo; README is the install surface |
| railway.toml, examples | Not in this repo |

`dev-docs/` itself is gitignored. It is local contributor material, not
part of the published package.

Endpoint contracts, quirks, and release constraints live in:

- [api-contract-matrix.md](./api-contract-matrix.md)
- [api-quirks.md](./api-quirks.md)
- [terms-release-gate.md](./terms-release-gate.md)
- [source-log.md](./source-log.md)
