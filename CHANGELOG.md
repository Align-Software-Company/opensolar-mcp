# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-09-23

Initial public release.

### Added

- 75 MCP tools across projects, contacts, events, systems, components, workflows, payment options, pricing schemes, costings, reference data, private files, webhooks, Teams, and Raw Data.
- A curated 32-tool `agent` profile (the default) and a `full` profile, plus `OPENSOLAR_TOOLSETS`, `OPENSOLAR_READ_ONLY`, and `OPENSOLAR_PLAN` filters.
- Semantic tools built from documented reads: bounded project and contact search with `unique`, `none`, `ambiguous`, and `incomplete` resolution states, project snapshots, stage changes by name, project-system comparison, sectioned project-design projections, and a read-only project-share preflight.
- stdio and stateless Streamable HTTP transports on the official MCP TypeScript SDK v2, implementing the 2026-07-28 protocol with fallback for 2025-era clients.
- Server identity metadata (title, description, website) and private five-minute cache hints for `tools/list` and `server/discover`.
- A title, output schema, and behavior annotations on every tool.
- `--check`, `--list-tools`, and `--version` commands.
- MCP Registry metadata (`server.json`) that declares the required and optional configuration.
- A Docker image that runs as an unprivileged user, with a health check and OCI and MCP Registry labels.
- Contribution guide, security policy, code of conduct, issue and pull request templates, and Dependabot configuration.
- Offline test suite plus packaged-artifact, stdio, HTTP, and Docker smoke tests in CI, and gated live integration tests.

### Security

- Bring-your-own-token authentication with no credential persistence.
- Non-loopback HTTP requires a Bearer token on every request and never falls back to the environment token; Host and Origin allowlists guard against DNS rebinding.
- `OPENSOLAR_READ_ONLY` rejects unrecognized values instead of silently leaving mutations enabled.
- Writes are never retried automatically; reads retry HTTP 429 at most three times.
- Redaction of credentials, signed URLs, integration secrets, and personal identity fields from model-facing output.
- Local uploads confined to `OPENSOLAR_UPLOAD_ROOT`, including through symlinks; 10 MB download caps; bounded Raw Data decompression.

[Unreleased]: https://github.com/Align-Software-Company/opensolar-mcp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Align-Software-Company/opensolar-mcp/releases/tag/v0.1.0
