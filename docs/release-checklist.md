# Release checklist

Technical readiness, package publication, and any future managed hosting are separate decisions.

Last reviewed: 2026-09-23

The package version under review is `0.1.0`. This checklist does not publish it.

## Technical artifact

The original RC artifact was verified at `6e1bd14`. The final `0.1.0` release branch incorporates the subsequent HTTP/authentication, Origin, upload-confinement, binary-output, Docker/runtime, public-repo, search-resolution, Registry-metadata, and documentation hardening. The exact `0.1.0` artifact must pass the full release gate before publication.

- [x] `pnpm check:all` is green. The ordinary suite does not call OpenSolar. The current search-safety tree passed 39 files / 262 tests.
- [x] `pnpm build` is green. Post-audit CI built the release bundle successfully.
- [x] `npm pack` contains only `package.json`, `README.md`, `LICENSE`, and `dist/` (five files total including the source map).
- [x] A clean `npm install` of the tarball runs `--help`, the 32-tool agent profile, the 75-tool full profile, the five webhook tools, and rejects an unknown profile.
- [x] Installed stdio completes `initialize`, `tools/list`, and one mocked read. Logs stay on stderr.
- [x] Installed loopback HTTP serves `/health`, `/ready`, initializes MCP, and lists the agent profile.
- [x] Installed non-loopback HTTP requires a per-request Bearer token even when `OPENSOLAR_API_TOKEN` is set in the server environment, and succeeds with an explicit Bearer token. The release smoke passed `http_public_requires_request_bearer=ok`.
- [x] Binding `0.0.0.0` without `MCP_HTTP_ALLOWED_HOSTS` fails closed.
- [x] `create_private_file` is disabled without `OPENSOLAR_UPLOAD_ROOT` and cannot escape the configured real path, including through symlinks; the offline test suite covers both cases.
- [x] Binary private files and system images are not duplicated as base64 in `structuredContent`; the offline test suite covers image, PDF, and generic binary behavior.
- [x] The release-smoke implementation checks both supported local env files without printing token values. CI had no local tokens to search and its tarball secret scan was clear.
- [x] Post-audit Docker smoke passed in CI: runtime UID 1000, health/readiness on a non-default container port, 401 without a Bearer token, untrusted browser Origin rejected, and the 32-tool agent profile exposed.
- [x] GitHub Dependabot reported 0 open alerts on 2026-09-23.
- [x] Public project guides include `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `AGENTS.md`, and a thin `CLAUDE.md` entry point.
- [x] MCP Registry metadata is staged in `server.json`; `package.json#mcpName`, package/version identity, stdio transport, and required environment-variable metadata are checked by `pnpm check:registry`.
- [x] The Registry metadata uses the official 2025-12-11 schema URI. Registry publication remains deferred until after the npm artifact exists.

`prepack` runs `pnpm check:all && pnpm build`. Packaging must not require OpenSolar credentials or call OpenSolar.

## OpenSolar/API

- [x] Tools call the official OpenSolar API only.
- [x] Throttle behavior is documented. Ordinary JSON reads use bounded 429 retry; writes are not retried.
- [x] Writes whose request contracts are not established stay unregistered.
- [x] The package is self-hosted software. The caller supplies their own OpenSolar access; there is no token vault or multi-customer service in this repository.
- [x] Raw Data entitlement is documented. `OPENSOLAR_PLAN=api_access` omits `get_proposal_data` and `get_project_design`.
- [x] Bounded contact/project searches expose a conservative `resolution`; only an exhaustive one-match scan reports `unique`.

## Package publication decision

Publishing this self-hosted source/package is a maintainer release decision. This checklist does not make a legal conclusion that OpenSolar consent is or is not required for software distribution.

- [ ] Maintainer approves publishing the exact tested `0.1.0` commit and npm artifact.
- [ ] Publish the final npm artifact before publishing the matching `server.json` to the MCP Registry.
- [ ] Publish the matching MCP Registry metadata only after the npm package ownership check can succeed.
- [x] The `0.1.0` release does not include an Align-operated shared or multi-customer OpenSolar service.

## Managed hosting — separate future track

OpenSolar's current User Terms include restrictions on operating as a proxy, aggregator, or third-party service interface without prior written consent. That issue is materially more direct for any future Align-operated shared service than for this self-hosted package.

Managed/shared hosting is outside the `0.1.0` package release:

- [x] No managed/shared OpenSolar service is part of this release.
- [ ] Before any future Align-operated shared service goes live, review and authorize that operating model separately.

Do not treat the managed-hosting checkbox as a blocker to testing or packaging the self-hosted client. Do not publish until the maintainer makes the package-publication decision above.
