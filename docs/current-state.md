# Current implementation

Snapshot of what this package actually ships today, as distinct from
contributor plans in `dev-docs/`. Use this file when comparing later
architecture work against the walking skeleton.

Last reviewed: 2026-09-22

---

## Baseline

| Item | Value |
|------|-------|
| Package | `@alignco/opensolar-mcp` `0.0.1` |
| Branch | `main` |
| Node | `>=24` (`.nvmrc` is `24`) |
| Module | ESM (`"type": "module"`) |
| Package manager | pnpm |
| License | MIT (`LICENSE`; copyright Align Software Company 2026) |
| README | Install instructions and the 72 registered tools. Public release checklist is not done. |

The annotated tag `pre-rebase-baseline` still points at the earlier
walking-skeleton snapshot. This file describes the tree through phase 8
of `dev-docs/plan/v1-2026-09-22.md` (phase 2 reads, phase 3 writes,
registered phase 4 writes, phase 5 file tools, phase 6 webhooks, phase 7
team tools, and the raw-data tools).

---

## Package and toolchain

Runtime dependencies:

| Package | Range in `package.json` |
|---------|-------------------------|
| `@modelcontextprotocol/server` | `^2.0.0` |
| `@modelcontextprotocol/hono` | `^2.0.0` |
| `@hono/node-server` | `^2.1.1` |
| `hono` | `^4.13.3` |
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
| 004 BYO-token | Header → env → fail; no OAuth; no persistence | HTTP reads `Authorization: Bearer` per request, then `OPENSOLAR_API_TOKEN`. Stdio and `--check` require the env token. |
| 005 Redaction scope | Keep surgical + wholesale redaction | `src/lib/redaction.ts` is used by org, project, contact, and role paths. |

Env vars: `OPENSOLAR_API_TOKEN`, `OPENSOLAR_ORG_ID`, `OPENSOLAR_BASE_URL`,
`OPENSOLAR_TOOLSETS`, `OPENSOLAR_READ_ONLY`, `OPENSOLAR_PLAN`,
`MCP_TRANSPORT`, `MCP_HTTP_HOST`, `MCP_HTTP_PORT`, `MCP_HTTP_PATH`,
`MCP_HTTP_ALLOWED_HOSTS`.

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

MCP server identity: `{ name: '@alignco/opensolar-mcp', version: '0.0.1' }`.
The server advertises tools only (no empty resources/prompts handlers).

Server instructions are five lines in `src/lib/server-instructions.ts`:
read before mutate, one page per list call, access-plan omissions, no
invented IDs or bulk loops, do not open repository files for OpenSolar
answers.

---

## Tool inventory

Registration: `src/tools/index.ts` registers toolsets in this order:
`projects`, `org`, `contacts`, `events`, `systems`, `components`,
`workflow`, `payment`, `pricing`, `costing`, `reference`, `files`,
`webhooks`, `teams`, `raw_data`. Filtered by `OPENSOLAR_TOOLSETS`, `OPENSOLAR_READ_ONLY`, and
`OPENSOLAR_PLAN`. `OPENSOLAR_PLAN=api_access` omits `get_proposal_data` and `get_project_design`.

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

72 tools are registered. `search_projects` and `search_contacts` page the documented lists and match locally. They do not send a `search` query. Nine writes from the documented inventory are
not, because those pages list the method and show no request example:
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
downloads the file on the server. Text the model reads is capped at
100,000 characters. Images are an MCP image block. PDFs include
extracted text and an embedded `application/pdf` resource at
`opensolar://private-files/{id}`. A body over 10 MB is `isError`. The
download URL is never returned. `create_private_file` takes a filesystem
path and `title` and streams multipart `file_contents`.
`update_private_file` sends `{ title }`. `delete_private_file` and
`generate_project_document` return `{ id, deleted: true }` and `{ id }`
respectively. `generate_project_document` does not return bytes.
`get_system_image` requires `width` and `height`, uses a 120 second
timeout, and returns `id` only when the response exposes a private file
id, plus `content_type`. `OPENSOLAR_READ_ONLY=1` omits it.

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
events a month. The server does not count them.

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

`get_proposal_data` takes one `project_id` and calls
`GET user_logins/?project_ids=`. It returns system name, annual kWh,
monthly kWh, payback year, net present value, IRR, and return on
investment. A compressed `output` string is decoded before those numbers
are read. Design blobs, panel coordinates, pricing objects, and the
compressed strings are omitted. The proposal page does not list keys
inside `data.pricing`, `line_items`, or `payment_options`. HTTP 402
means Raw Data API Access is missing.

`get_project_design` reads `design` from `GET orgs/:org_id/projects/:id/`.
A missing or null design returns `{ design_available: false }`. A present
design is gunzipped. The summary is `system_count` and, on each system,
`system_price_including_tax` when that value is a number. The decompress
section names those keys. It describes module quantities, component
details, and annual production without naming keys, so those are not
returned. The compressed string is not returned. `get_project` verbose
still replaces `design` with `[REDACTED]`.

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

- `src/client/auth.ts` — per-request `Authorization` header, then env
- `src/client/errors.ts` — sanitized 401/402/403/404/429/504 tool messages;
  `openSolarSuccess` / `runOpenSolarTool`

Not present as modules (planned in `dev-docs/directory.md`):

- `src/client/tier.ts` — no live plan detection
- `src/client/pagination.ts` — tools build query strings themselves
- `src/client/rate-limit.ts` — no 429 backoff

Config: [`src/lib/config.ts`](../src/lib/config.ts). Zod-validated.
Stdio and `--check` fail if token or org id is missing. HTTP requires
org id at startup; the token may arrive per request.

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
`dev-docs/private/.env.local`) when `OPENSOLAR_API_TOKEN` and
`OPENSOLAR_ORG_ID` are set. It reads the org, an event URL from project
`events_data`, and contact `ordering`. It also creates, updates, and
deletes one fixture contact. CI runs `pnpm check:all`, which excludes
`tests/integration`.

---

## Planned vs built

The work order is `dev-docs/plan/v1-2026-09-22.md`. First public release
is that plan's documented OpenSolar inventory. `dev-docs/tools-roadmap.md`
is historical (it still describes a 19-tool v1). Phase 2 reads, phase 3 writes, the registered phase 4 writes, phase 5 file tools, phase 6 webhooks, phase 7 team tools, and the raw-data tools run today.

| Plan said | Code today |
|-----------|------------|
| HTTP transport | Stateless Streamable HTTP via `createMcpHandler` |
| `--check` / `--list-tools` | Implemented |
| Tool titles, `outputSchema`, `structuredContent` | Implemented for the registered reads and writes |
| Documented inventory | 72 tools registered, including derived `search_projects` and `search_contacts`. Nine writes wait on a published request example. The public release checklist is not done. |
| `OPENSOLAR_TOOLSETS` / `OPENSOLAR_READ_ONLY` | Read at registration |
| Client GET timeout | Implemented (30s default; per-call override) |
| Client auth / errors | Present |
| Client tier / pagination / rate-limit modules | Still missing |
| POST/PUT/PATCH/DELETE client | Implemented. Writes are not retried |
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
