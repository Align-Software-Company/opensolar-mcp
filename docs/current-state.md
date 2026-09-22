# Current implementation

Snapshot of what this package actually ships today, as distinct from
contributor plans in `dev-docs/`. Use this file when comparing later
architecture work against the walking skeleton.

Last reviewed: 2026-08-22

---

## Baseline

| Item | Value |
|------|-------|
| Package | `@alignco/opensolar-mcp` `0.0.1` |
| Branch | `main` |
| Node | `>=24` (`.nvmrc` is `24`) |
| Module | ESM (`"type": "module"`) |
| Package manager | pnpm |
| License field | MIT (no `LICENSE` file in the published tree yet) |

The annotated tag `pre-rebase-baseline` still points at the earlier
walking-skeleton snapshot. This file describes the tree as of the MCP v2
runtime migration.

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
| 005 Redaction scope | Keep surgical + wholesale redaction | `src/lib/redaction.ts` is used by org, project, and contact paths. |

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
| `--list-tools` | Implemented | `src/cli/list-tools.ts` |
| `--help` | Implemented | `src/cli/help.ts` |
| `--http` / bind / path | Implemented | `src/lib/config.ts` + `src/transports/http.ts` |

MCP server identity: `{ name: '@alignco/opensolar-mcp', version: '0.0.1' }`.
The server advertises tools only (no empty resources/prompts handlers).
Server instructions cover read-before-mutate, pagination, access-plan
notes, and mutation safety.

---

## Tool inventory

Registration: `src/tools/index.ts` registers four toolsets, filtered by
`OPENSOLAR_TOOLSETS`, `OPENSOLAR_READ_ONLY`, and `OPENSOLAR_PLAN`.


| Tool | Toolset file | `TIER_POLICY` | HTTP | Status |
|------|--------------|---------------|------|--------|
| `list_projects` | `src/tools/projects.ts` | `api_access`, read | `GET orgs/:org_id/projects/?limit=&page=` | Implemented |
| `get_project` | `src/tools/projects.ts` | `api_access`, read, `degradesWith: ['design']` | `GET orgs/:org_id/projects/:id/` | Implemented |
| `get_org` | `src/tools/org.ts` | `api_access`, read | `GET orgs/:org_id/` | Implemented |
| `list_contacts` | `src/tools/crm.ts` | `api_access`, read | `GET orgs/:org_id/contacts/?page=&limit=&ordering=` | Implemented |
| `get_contact` | `src/tools/crm.ts` | `api_access`, read | `GET orgs/:org_id/contacts/:id/` | Implemented |
| `get_event` | `src/tools/events.ts` | `api_access`, read | `GET orgs/:org_id/events/:event_id/` | Implemented |
| `create_project` | — | — | `POST /api/orgs/:org_id/projects/` | Not implemented |
| `update_project` | — | — | `PATCH /api/orgs/:org_id/projects/:id/` | Not implemented |
| `update_project_stage` | — | — | `PATCH /api/orgs/:org_id/projects/:id/` | Not implemented |
| `search_contacts` | — | — | see [api-contract-matrix.md](./api-contract-matrix.md) | Not implemented; search not assumed |
| `create_contact` | — | — | `POST /api/orgs/:org_id/contacts/` | Not implemented |
| `list_project_systems` | — | — | `GET /api/orgs/:org_id/systems/?fieldset=list&project=` | Not implemented |
| `get_system` | — | — | `GET /api/orgs/:org_id/systems/:id/?fieldset=list` | Not implemented |
| `get_system_details` | — | — | `GET /api/orgs/:org_id/projects/:project_id/systems/details/` | Not implemented |
| `list_modules` | — | — | `GET /api/orgs/:org_id/component_module_activations/` | Not implemented |
| `list_inverters` | — | — | `GET /api/orgs/:org_id/component_inverter_activations/` | Not implemented |
| `list_batteries` | — | — | `GET /api/orgs/:org_id/component_battery_activations/` | Not implemented |
| `list_workflows` | — | — | `GET /api/orgs/:org_id/workflows/` | Not implemented |
| `list_roles` | — | — | `GET /api/orgs/:org_id/roles/` | Not implemented |
| `list_payment_options` | — | — | `GET /api/orgs/:org_id/payment_options/` | Not implemented |

Shipped extras on implemented tools (not extra HTTP parameters):

- `verbose` on `list_projects`, `get_project`, `get_org`
- curated vs redacted payloads
- `is_synthetic_email` on contacts
- `event_type_name` on events / curated project events
- `design_available` and curated `events` on `get_project`

`get_project` curated output still includes deprecated `stage`. It does not
surface `workflow.active_stage_id`. See [api-contract-matrix.md](./api-contract-matrix.md).

---

## Client capabilities

[`src/client/index.ts`](../src/client/index.ts):

- GET only
- `Authorization: Bearer` from the resolved token
- Throws `OpenSolarApiError` with status and body text on non-OK
- Parses JSON; empty body → `null`
- Base URL from config, trailing slash normalized

Present:

- `src/client/auth.ts` — per-request `Authorization` header, then env

Not present as modules (planned in `dev-docs/directory.md`):

- `src/client/tier.ts` — no live plan detection
- `src/client/pagination.ts` — tools build query strings themselves
- `src/client/rate-limit.ts` — no 429 backoff
- `src/client/errors.ts` — no 401/402/403 mapping

Config: [`src/lib/config.ts`](../src/lib/config.ts). Zod-validated.
Stdio and `--check` fail if token or org id is missing. HTTP requires
org id at startup; the token may arrive per request.

Logging: [`src/lib/log.ts`](../src/lib/log.ts) writes JSON lines to stderr
for every level so stdio stdout stays protocol-clean.

---

## Schema inventory

| File | Role |
|------|------|
| `src/schemas/project.ts` | `ProjectSummarySchema` (list is a bare array), `ProjectFullSchema`, `curateProject` |
| `src/schemas/contact.ts` | `ContactSchema` (`id`, `email`, passthrough), list as array |
| `src/schemas/event.ts` | `EventSchema`, `curateProjectEvent` |
| `src/schemas/org.ts` | `OrgSchema`, `curateOrg` |

Not present: `system.ts`, `component.ts`, `workflow.ts`, `payment.ts`,
`shared.ts`.

Related libraries: `src/lib/redaction.ts`, `src/lib/contact-enrich.ts`,
`src/lib/enums/event-types.ts`.

---

## Build baseline log

`pnpm test` never reads `.env.local` and never calls OpenSolar.
`pnpm test:integration` loads gitignored `.env.local` (or
`dev-docs/private/.env.local`) and issues a read-only `GET /orgs/:id/`
when `OPENSOLAR_API_TOKEN` and `OPENSOLAR_ORG_ID` are set.

---

## Planned vs built

`dev-docs/directory.md` and `dev-docs/tools-roadmap.md` still describe a
v1 surface of 19 tools plus user docs. The runtime and MCP protocol
foundation is in place; OpenSolar coverage is still the original six
read tools.

| Plan said | Code today |
|-----------|------------|
| HTTP transport | Stateless Streamable HTTP via `createMcpHandler` |
| `--check` / `--list-tools` | Implemented |
| 19 v1 tools | 6 tools |
| `OPENSOLAR_TOOLSETS` / `OPENSOLAR_READ_ONLY` | Read at registration |
| Client auth / tier / pagination / rate-limit / errors modules | Auth present; the rest still missing |
| vitest, `pnpm test`, CI | Present; CI on Node 24 |
| User docs (`authentication.md`, `tiers.md`, `tools.md`, …) | Missing |
| README, Dockerfile, railway.toml, examples | Missing from git |

`dev-docs/` itself is gitignored. It is local contributor material, not
part of the published package.

Endpoint contracts, quirks, and release constraints live in:

- [api-contract-matrix.md](./api-contract-matrix.md)
- [api-quirks.md](./api-quirks.md)
- [terms-release-gate.md](./terms-release-gate.md)
- [source-log.md](./source-log.md)
