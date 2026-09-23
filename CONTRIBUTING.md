# Contributing

Thanks for contributing to OpenSolar MCP.

This project is an unofficial, self-hosted Model Context Protocol server for the documented OpenSolar API. Contributions should preserve the project's conservative API-contract and agent-safety approach.

## Development setup

Requirements:

- Node.js 24 or newer
- pnpm 10.34.5 via Corepack

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check:all
pnpm build
```

Docker changes should also pass:

```bash
pnpm test:docker
```

The ordinary test suite is offline and must not require OpenSolar credentials.

## Before opening a pull request

Run:

```bash
pnpm check:all
pnpm build
```

If your change affects packaging, transports, authentication, Docker, or the published artifact, also verify the relevant release smoke paths documented in `docs/release-checklist.md`.

Keep pull requests focused. Separate unrelated refactors, feature work, documentation cleanup, and API-contract changes when practical.

## OpenSolar API contract rules

Treat the official OpenSolar API documentation as the primary source of truth.

Do not infer write payloads from:

- response objects;
- conventional REST behavior;
- another endpoint with a similar shape;
- Django REST Framework conventions;
- old or third-party code.

A documented OpenSolar operation may be implemented when its request contract is sufficiently established through authoritative documentation or deliberate live verification that is recorded in the repository.

The absence of an example request is not, by itself, evidence that an operation is unsupported.

When an API behavior is verified or its status changes, update the relevant documentation, especially:

- `docs/api-contract-matrix.md`
- `docs/api-quirks.md`
- `docs/source-log.md`
- `docs/current-state.md`, when the implementation state changes

Do not put live customer data, credentials, organisation IDs, project IDs, event IDs, system UUIDs, or other unnecessary production identifiers into tracked public documentation or fixtures.

## MCP and agent-design rules

Prefer semantic operations that help an agent complete a real task over exposing protocol plumbing.

Do not assume that one OpenSolar API operation should become one top-level MCP tool.

The default `agent` profile is deliberately curated. The `full` profile preserves the broader registered surface. Functional `OPENSOLAR_TOOLSETS` are a separate operator override.

Changes to tool names, schemas, descriptions, annotations, profile membership, toolset membership, or server instructions are public MCP behavior and should receive regression coverage.

For bounded project/contact search:

- only `resolution: unique` confirms one target;
- `resolution: incomplete` does not prove uniqueness;
- `resolution: ambiguous` must not be guessed through.

Mutation tools change a live OpenSolar organisation. Do not weaken read-only filtering, target-resolution safeguards, or mutation annotations.

Writes are not automatically retried.

## Security boundaries

Do not weaken the existing transport and file boundaries without a documented reason and tests.

In particular:

- non-loopback HTTP requires a per-request OpenSolar Bearer token;
- Host and browser-Origin allowlists are separate from authentication;
- public HTTP should be placed behind TLS termination;
- `create_private_file` is disabled unless `OPENSOLAR_UPLOAD_ROOT` is configured;
- resolved upload paths must remain inside that root, including through symlinks;
- binary/file size and Raw Data decompression limits should remain bounded;
- secrets must not be logged, committed, or copied into model-facing output.

## Live integration tests

Live integration tests are separate from the ordinary suite:

```bash
pnpm test:integration
```

Credentials alone must only enable read-only live checks.

Live mutation tests require an explicit write gate:

```bash
OPENSOLAR_INTEGRATION_WRITES=1 pnpm test:integration
```

Some live checks also require dedicated fixture IDs. See `.env.example`.

Do not use customer records as disposable test fixtures.

## Documentation and public surface

Keep the README focused on installation, configuration, normal use, safety, and development entry points. Put detailed API evidence and implementation history in `docs/`.

This project is unofficial and is not affiliated with or endorsed by OpenSolar Pty Ltd. Contributions should not imply otherwise.

## Reporting security issues

Follow [SECURITY.md](SECURITY.md). Do not post credentials, customer data, or a working exploit in a public issue.

## License

By contributing, you agree that your contribution may be distributed under the repository's MIT License.
