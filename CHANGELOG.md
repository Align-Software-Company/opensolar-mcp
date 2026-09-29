# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.3] - 2026-09-29

### Security

- `get_system_image` checks each redirect target before following it and drops the API token when leaving the OpenSolar API origin, matching file downloads.

### Known limitations

- Download targets are checked by DNS lookup before each request; the connection itself does not pin the checked address.

## [0.1.2] - 2026-09-29

### Added

- The tag workflow pushes `ghcr.io/align-software-company/opensolar-mcp` for `linux/amd64` and `linux/arm64` to GHCR, and `server.json` declares that image for Streamable HTTP on `http://localhost:3000/mcp`.

### Changed

- The publish workflow reports a private GHCR image with a clear message.

## [0.1.1] - 2026-09-28

### Security

- HTTP binds check Host and Origin even when the host is mixed-case `localhost`, and refuse MCP bodies over 4 MB with HTTP 413 before authentication. `/health` and `/ready` stay outside those checks.
- Generic secret field names and signed file URLs are redacted. Error bodies are scrubbed of the caller's bearer token before a tool message is built.
- OpenSolar JSON responses are capped at 32 MB while they are read. Local uploads are capped at 25 MB and are opened without following a final symlink.
- `OPENSOLAR_BASE_URL` must be https, except http for `localhost`, `127.0.0.1`, and `[::1]`.

### Changed

- OpenSolar error messages explain the failure instead of telling the caller what to do. HTTP 400, 409, and 422 include sanitized field details. HTTP 413 explains the size limit. A timed-out write says the change may or may not have been applied.
- Webhook endpoints must be https. `share_project`, `share_entities`, and `update_webhook` are marked destructive. Search, title, note, URL, and page inputs have length bounds.
- The MCP SDK dependency is 2.2. The registry server name is `io.github.Align-Software-Company/opensolar-mcp`.
- Search reports add `identifier_match_id` for one exact email or phone match on a complete, untruncated scan. Server instructions treat that id, or `resolution: unique`, as confirmation, and they allow explicit per-item writes one call at a time.

### Added

- A server icon, declared on the MCP server info and in `server.json`.

### Known limitations

- System-image downloads still follow redirects automatically and do not use the download SSRF target check.
- Private-file downloads still re-resolve DNS after the address check.

Both remain open.

## [0.1.0] - 2026-09-23

Initial public release.

### Added

- 75 MCP tools across projects, contacts, events, systems, components, workflows, payment options, pricing schemes, costings, reference data, private files, webhooks, Teams, and Raw Data.
- A curated 31-tool `agent` profile (the default) and a `full` profile, plus `OPENSOLAR_TOOLSETS`, `OPENSOLAR_READ_ONLY`, and `OPENSOLAR_PLAN` filters. `share_project` remains available through `full` or the Teams toolset pending live verification of multi-org share preservation.
- Semantic tools built from documented reads: bounded project and contact search with `unique`, `none`, `ambiguous`, and `incomplete` resolution states, project snapshots, stage changes by name, project-system comparison, sectioned project-design projections, and a read-only project-share preflight.
- stdio and stateless Streamable HTTP transports on the official MCP TypeScript SDK v2, implementing the 2026-07-28 protocol with fallback for 2025-era clients.
- Server identity metadata (title, description, website) and private five-minute cache hints for `tools/list` and `server/discover`.
- A title, output schema, and behavior annotations on every tool.
- Compact JSON text alongside successful `structuredContent` for clients that do not forward structured tool output.
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

[Unreleased]: https://github.com/Align-Software-Company/opensolar-mcp/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/Align-Software-Company/opensolar-mcp/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/Align-Software-Company/opensolar-mcp/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/Align-Software-Company/opensolar-mcp/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Align-Software-Company/opensolar-mcp/releases/tag/v0.1.0
