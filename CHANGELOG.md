# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses semantic versioning.

## [Unreleased]

### Added

- Public contribution, security, agent-development, and MCP Registry metadata.
- Repository and Docker release-hygiene checks.
- Conservative bounded-search resolution states.

### Changed

- Hardened non-loopback HTTP authentication and browser-Origin validation.
- Confined local private-file uploads to an explicit upload root.
- Kept binary file/image bytes out of structured JSON output.
- Bounded compressed Raw Data expansion.
- Reworked the README into a release-facing user guide.
- Hardened the Docker runtime and added image-level CI smoke coverage.

## [0.1.0-rc.1] - 2026-09-23

### Added

- Initial release-candidate package for the documented OpenSolar API.
- 75 registered MCP tools across projects, contacts, systems, components, workflow, commercial configuration, files, webhooks, Teams, reference data, and Raw Data.
- Curated 32-tool default `agent` profile and full profile.
- Functional toolset overrides, read-only filtering, and OpenSolar plan filtering.
- Semantic project/contact search with bounded scans.
- Project operational snapshots.
- Human-readable project stage resolution.
- Project-system comparison.
- Sectioned project-design projections.
- Project-share preflight.
- Stdio and stateless Streamable HTTP transports.
- Bounded HTTP 429 retry for ordinary JSON reads.
- Package, installed-artifact, stdio, HTTP, and Docker smoke testing.

### Security

- BYO-token authentication with no intentional credential persistence.
- Structured-output redaction.
- Size limits for private-file downloads and system images.
- Explicit gating for live integration writes.

[Unreleased]: https://github.com/Align-Software-Company/opensolar-mcp/compare/v0.1.0-rc.1...HEAD
[0.1.0-rc.1]: https://github.com/Align-Software-Company/opensolar-mcp/releases/tag/v0.1.0-rc.1
