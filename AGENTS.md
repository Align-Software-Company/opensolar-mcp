# AGENTS.md

This file is the canonical repository guide for coding agents working on OpenSolar MCP.

## Project

OpenSolar MCP is an unofficial, self-hosted Model Context Protocol server for the documented OpenSolar API.

The public package is intended to run in the user's own environment with the user's own OpenSolar credentials. Do not turn this repository into a shared or multi-customer proxy service.

## Setup

Requirements:

- Node.js 24+
- pnpm 10.34.5 via Corepack

Install and verify:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check:all
pnpm build
```

Docker-affecting changes should also pass:

```bash
pnpm test:docker
```

The normal test suite must remain offline.

## Architecture

The server uses the official MCP TypeScript v2 packages directly. It does not use FastMCP.

Important layers:

- `src/client/` — OpenSolar HTTP client, auth, retries, errors
- `src/tools/` — MCP tool registration
- `src/schemas/` — public structured schemas
- `src/lib/` — semantic helpers, policy, redaction, bounded scans
- `src/transports/` — stdio and stateless Streamable HTTP
- `tests/smoke/` — offline behavior and regression coverage
- `tests/integration/` — explicitly gated live OpenSolar verification
- `docs/` — contract evidence, quirks, current state, release records

## API-contract rules

Treat official OpenSolar documentation as the primary source of truth.

Do not invent a write body from:

- response objects;
- conventional REST behavior;
- Django REST Framework conventions;
- similar endpoints;
- old or third-party implementations.

A write may be exposed only when its request contract is sufficiently established through authoritative documentation or deliberate live verification that is recorded in the repository.

The absence of a sample request does not, by itself, mean an operation is unsupported.

When API evidence changes, update the relevant records:

- `docs/api-contract-matrix.md`
- `docs/api-quirks.md`
- `docs/source-log.md`
- `docs/current-state.md` when implementation state changes

Never put live credentials, customer data, organisation IDs, project IDs, event IDs, system UUIDs, or other unnecessary production identifiers in public docs or fixtures.

## Tool design

Do not assume one API endpoint should equal one MCP tool.

Prefer semantic tools that let an agent complete a real operation safely.

The concepts are intentionally distinct:

- profile = curated operating surface
- toolset = functional domain
- read-only = mutation restriction
- plan = OpenSolar entitlement restriction

The default `agent` profile is deliberately curated. `full` exposes all registered tools. `OPENSOLAR_TOOLSETS` is an explicit functional override.

Do not change profile or toolset membership casually. Tool names, schemas, annotations, descriptions, server instructions, and exposure policy are public behavior and need regression tests.

## Entity resolution

Project/contact searches are bounded local scans.

Only:

```text
resolution: unique
```

confirms a target.

`resolution: incomplete` means the bounded scan cannot prove uniqueness. `resolution: ambiguous` means multiple matches were observed. Do not guess through either state.

## Mutations

Mutations affect the live OpenSolar organisation.

- Writes are not automatically retried.
- Preserve `OPENSOLAR_READ_ONLY`.
- Preserve mutation annotations.
- Resolve human-facing identifiers conservatively.
- Do not simulate undocumented bulk operations by looping mutations.

## HTTP security

Do not weaken these boundaries without explicit justification and tests:

- non-loopback HTTP requires a per-request Bearer token;
- malformed Authorization must not fall back to an env token;
- Host and Origin allowlists are separate from authentication;
- internet-facing HTTP requires external TLS termination;
- health/readiness endpoints must stay free of customer data and credentials.

## File and Raw Data safety

- `create_private_file` remains disabled without `OPENSOLAR_UPLOAD_ROOT`.
- Resolve real paths and prevent root escape, including symlinks.
- Keep file/download sizes bounded.
- Do not duplicate binary bytes into structured JSON.
- Keep compressed Raw Data decompression bounded.

## Tests

Before finishing a change:

```bash
pnpm check:all
pnpm build
```

Use `pnpm test:docker` for Docker/runtime changes.

Live integration tests are separate:

```bash
pnpm test:integration
```

Credentials alone must enable read-only live tests only. Live writes require:

```bash
OPENSOLAR_INTEGRATION_WRITES=1 pnpm test:integration
```

Do not use customer records as disposable fixtures.

## Release and package rules

Do not publish npm, MCP Registry metadata, a GitHub Release, or a hosted service unless the maintainer explicitly asks.

Keep `package.json`, `server.json`, and the server-reported version synchronized.

The package tarball should remain narrow: package metadata, README, LICENSE, and `dist/`.

When release behavior changes, update `docs/release-checklist.md`.

## Public documentation

Keep README user-facing. Detailed evidence and implementation history belong under `docs/`.

Keep `CONTRIBUTING.md`, `SECURITY.md`, and `CHANGELOG.md` accurate when relevant behavior changes.

This project is unofficial. Do not imply affiliation with or endorsement by OpenSolar.
