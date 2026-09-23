# Contributing

Thanks for contributing to OpenSolar MCP.

OpenSolar MCP is an unofficial, self-hosted Model Context Protocol server for the documented OpenSolar API. Contributions should keep the public API surface predictable, preserve safety boundaries around writes and credentials, and avoid relying on undocumented OpenSolar behavior.

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting bugs and requesting features

Use the [issue forms](https://github.com/Align-Software-Company/opensolar-mcp/issues/new/choose). Include the output of `opensolar-mcp --version`, your transport and MCP client, and a reproduction that uses synthetic values. Feature requests for new OpenSolar operations are much easier to act on with a link to the relevant [OpenSolar API documentation](https://developers.opensolar.com/api/).

Report security problems privately as described in [SECURITY.md](SECURITY.md).

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

For Docker or HTTP-runtime changes, also run:

```bash
pnpm test:docker
```

The ordinary test suite is offline and does not require OpenSolar credentials.

## Pull requests

Before opening a pull request, run:

```bash
pnpm check:all
pnpm build
```

Changes that affect packaging, authentication, transports, Docker, or the published artifact should also satisfy the checks in [docs/release-checklist.md](docs/release-checklist.md).

Keep pull requests focused. Separate unrelated feature work, refactors, documentation changes, and API-contract changes when practical.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat(tools): ...`, `fix(client): ...`, `docs: ...`). Add a `CHANGELOG.md` entry under **Unreleased** for user-facing changes.

## OpenSolar API contracts

The official OpenSolar API documentation is the primary source for request and response contracts.

Do not infer a write payload from a response object, conventional REST behavior, a similar endpoint, framework conventions, or third-party code. A mutation should be exposed only when its request contract is supported by authoritative documentation or recorded live verification.

When API behavior changes or new evidence is added, update the relevant references:

- [API contract matrix](docs/api-contract-matrix.md)
- [API quirks](docs/api-quirks.md)
- [Source log](docs/source-log.md)
- [Current implementation](docs/current-state.md), when shipped behavior changes

Public documentation and fixtures must not contain live credentials, customer data, organisation IDs, project IDs, event IDs, system UUIDs, signed file URLs, or other production identifiers.

## Tool design

Prefer task-oriented MCP operations over thin protocol plumbing when a stable semantic operation can be defined.

The public surfaces are intentionally distinct:

- `agent` is the curated default profile.
- `full` exposes all registered tools.
- `OPENSOLAR_TOOLSETS` selects complete functional categories.
- `OPENSOLAR_READ_ONLY` removes mutation tools.
- `OPENSOLAR_PLAN` removes tools that require unavailable OpenSolar access tiers.

Tool names, schemas, descriptions, annotations, profile membership, toolset membership, and server instructions are public behavior and should have regression coverage.

For bounded project and contact search:

- `resolution: unique` confirms a single target only after the scan is complete.
- `resolution: incomplete` means uniqueness was not established.
- `resolution: ambiguous` means multiple matches were observed.

Writes are not automatically retried.

## Security boundaries

Changes must preserve the existing credential, transport, file, and resource limits unless the change includes a documented reason and tests.

In particular:

- non-loopback HTTP requires a per-request OpenSolar Bearer token;
- Host and browser-Origin allowlists are separate from authentication;
- internet-facing HTTP requires TLS termination outside this server;
- local file upload is disabled unless `OPENSOLAR_UPLOAD_ROOT` is configured;
- upload paths are resolved and confined to that root, including through symlinks;
- private-file downloads and system images are size-limited;
- compressed Raw Data expansion is bounded;
- secrets must not be logged, committed, or returned in model-facing output.

## Live integration tests

Live integration tests are separate from the ordinary suite:

```bash
pnpm test:integration
```

Credentials alone enable read-only live checks. Live mutation tests additionally require:

```bash
OPENSOLAR_INTEGRATION_WRITES=1 pnpm test:integration
```

Some checks require dedicated fixture IDs documented in [`.env.example`](.env.example). Do not use customer records as disposable fixtures.

## Documentation

The README should stay focused on installation, configuration, normal operation, and user-facing safety notes. Detailed endpoint evidence and implementation notes belong under `docs/`.

This project is not affiliated with or endorsed by OpenSolar Pty Ltd.

## Security reports

Follow [SECURITY.md](SECURITY.md). Do not post credentials, customer data, or working exploit details in a public issue.

## License

By contributing, you agree that your contribution may be distributed under the repository's MIT License.
