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
| Runtime commit | `e838de7` (`feat(tools): add get_event and surface events_data on get_project`) |
| Branch | `main` |
| Tag | `pre-rebase-baseline` (annotated; points at the commit that added this snapshot) |
| Node | `>=20` (`.nvmrc` is `20`) |
| Module | ESM (`"type": "module"`) |
| Package manager | pnpm |
| License field | MIT (no `LICENSE` file in the published tree yet) |

Runtime behavior is the code at `e838de7`. Files added with this snapshot
(reference docs and a token-free test harness) do not change transports,
tools, or the OpenSolar client.

---

## Package and toolchain

Runtime dependencies:

| Package | Range in `package.json` |
|---------|-------------------------|
| `@modelcontextprotocol/sdk` | `^1.29.0` (resolved `1.29.0`) |
| `zod` | `^3.25.76` |

Dev dependencies at `e838de7`: `@biomejs/biome`, `@types/node`, `tsup`,
`tsx`, `typescript`. No Hono. No vitest until the harness in this snapshot.

Scripts at `e838de7`:

| Script | Command | Status at `e838de7` |
|--------|---------|---------------------|
| `dev` | `tsx src/index.ts` | present |
| `build` | `tsup` | present |
| `typecheck` | `tsc --noEmit` | present |
| `lint` | `biome check .` | present |
| `format` | `biome format --write .` | present |
| `test` | — | missing |
| `test:integration` | — | missing |
| `check:all` | — | missing |
| `docs:generate` | — | missing |

Binary: `opensolar-mcp` → `./dist/index.js`. Bundler is tsup, ESM, `target:
node20`, shebang banner, no DTS.

---

## Architecture record

Accepted decisions (local `dev-docs/decisions/`):

| ADR | Decision | Wired in code today |
|-----|----------|---------------------|
| 001 Dual transport | One binary, stdio default, `--http` / `MCP_TRANSPORT=http` for Streamable HTTP | Stdio only. HTTP exits 1 with a stub message. No `src/transports/` files, no Hono. |
| 002 Tier-policy as data | `src/lib/tier-policy.ts` is the only policy table | File exists for the six shipped tools. No runtime tier detection, no `--list-tools` consumer, no generated `docs/tools.md`. |
| 003 No frontend | No web UI | Held. |
| 004 BYO-token | Header → env → fail; no OAuth; no persistence | Env var only (`OPENSOLAR_API_TOKEN`). Per-request `Authorization` header is not implemented (HTTP transport missing). |
| 005 Redaction scope | Keep surgical + wholesale redaction | `src/lib/redaction.ts` is used by org, project, and contact paths. |

Env vars that exist in code: `OPENSOLAR_API_TOKEN` (required),
`OPENSOLAR_ORG_ID` (required), `OPENSOLAR_BASE_URL` (optional, default
`https://api.opensolar.com/api/`), `MCP_TRANSPORT` (stub).
`OPENSOLAR_TOOLSETS` and `OPENSOLAR_READ_ONLY` are not read.

---

## Transports and CLI

| Surface | Status | Location |
|---------|--------|----------|
| Stdio | Implemented | `src/index.ts` constructs `StdioServerTransport` and `createServer()` |
| Streamable HTTP | Stubbed; process exits 1 | `src/index.ts` (`--http` or `MCP_TRANSPORT=http`) |
| `--check` | Stubbed; process exits 1 | `src/index.ts` |
| `--list-tools` | Stubbed; process exits 1 | `src/index.ts` |
| `src/cli/` | Not present | — |
| `src/transports/` | Not present | — |

MCP server identity: `{ name: '@alignco/opensolar-mcp', version: '0.0.1' }`.
Capabilities advertised: tools, resources, prompts. Resource and prompt
lists return empty arrays.

---

## Tool inventory

Registration: `src/tools/index.ts` always registers four toolsets. No
toolset filter.

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
- `Authorization: Bearer` from config env
- Throws `OpenSolarApiError` with status and body text on non-OK
- Parses JSON; empty body → `null`
- Base URL from config, trailing slash normalized

Not present as modules (planned in `dev-docs/directory.md`):

- `src/client/auth.ts` — no header-vs-env precedence
- `src/client/tier.ts` — no plan detection
- `src/client/pagination.ts` — tools build query strings themselves
- `src/client/rate-limit.ts` — no 429 backoff
- `src/client/errors.ts` — no 401/402/403 mapping

Config: [`src/lib/config.ts`](../src/lib/config.ts). Zod-validated.
Startup fails if token or org id is missing.

Logging: [`src/lib/log.ts`](../src/lib/log.ts) writes JSON lines to stderr
for every level. No stdio-vs-HTTP split yet.

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

Commands run on 2026-08-22 against `e838de7` (no test runner yet). Failures
were recorded, not fixed.

```
pnpm build        exit 0   tsup ESM dist/index.js 34.27 KB
pnpm typecheck    exit 0
pnpm lint         exit 0   biome check, 22 files, no fixes
pnpm test         missing  no script, no vitest
```

`pnpm test` at `e838de7` is not a failing test suite; the command did not
exist.

This snapshot adds `pnpm test`, `pnpm test:integration`, and
`pnpm check:all`. On 2026-08-22 after the harness landed:

```
pnpm lint         exit 0
pnpm typecheck    exit 0
pnpm test         exit 0   8 passed, 1 skipped (live integration)
```

Those commands do not hit OpenSolar. They require no token.

---

## Planned vs built

`dev-docs/directory.md` and `dev-docs/tools-roadmap.md` describe a v1
surface of 19 tools, dual transport, CLI, tests, and user docs. The git
tree at `e838de7` is a six-tool stdio skeleton.

| Plan said | Code at `e838de7` |
|-----------|-------------------|
| HTTP transport | Stub exit in `src/index.ts` |
| `--check` / `--list-tools` | Stub exit |
| 19 v1 tools | 6 tools |
| `OPENSOLAR_TOOLSETS` / `OPENSOLAR_READ_ONLY` | Unread |
| Client auth / tier / pagination / rate-limit / errors modules | Missing (GET wrapper only) |
| vitest, `pnpm test`, CI | Missing at `e838de7` |
| User docs (`authentication.md`, `tiers.md`, `tools.md`, …) | Missing |
| README, Dockerfile, railway.toml, examples | Missing from git |

`dev-docs/` itself is gitignored. It is local contributor material, not
part of the published package.

Endpoint contracts, quirks, and release constraints live in:

- [api-contract-matrix.md](./api-contract-matrix.md)
- [api-quirks.md](./api-quirks.md)
- [terms-release-gate.md](./terms-release-gate.md)
- [source-log.md](./source-log.md)
