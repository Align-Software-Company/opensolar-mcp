# Release checklist

Release target: `0.1.0`  
Last reviewed: 2026-09-23

## Code and tests

- [x] `pnpm check:all` passes.
- [x] `pnpm build` passes.
- [x] The ordinary test suite runs without OpenSolar credentials.
- [x] Tool registration, annotations, schemas, profile filtering, and read-only filtering have regression coverage.
- [x] Bounded search reports `unique` only after a complete one-match scan.
- [x] Writes are not automatically retried.
- [x] Unrecognized `OPENSOLAR_READ_ONLY` values stop startup instead of exposing mutations.

## Package artifact

- [x] `prepack` runs the offline checks and build.
- [x] The npm tarball contains only package metadata, README, LICENSE, and `dist/`.
- [x] A clean tarball install runs `--help`, `--version`, and `--list-tools`.
- [x] The installed package reports the same version as `package.json`.
- [x] The default profile exposes 32 tools.
- [x] The full profile exposes 75 tools.
- [x] The webhook toolset exposes five tools.
- [x] Unknown profiles fail clearly.
- [x] The release artifact is scanned for known credential and customer-data markers.

## MCP transports

- [x] Installed stdio completes MCP initialization, tool listing, and a mocked read.
- [x] Logs remain on stderr.
- [x] Installed loopback HTTP serves health/readiness and MCP.
- [x] Non-loopback HTTP rejects MCP requests without a Bearer token even when an environment token exists.
- [x] Wildcard HTTP binding without `MCP_HTTP_ALLOWED_HOSTS` fails closed.
- [x] Untrusted browser Origin values are rejected when an allowlist is active.
- [x] A 2026-07-28 client negotiates the modern protocol over HTTP and receives server identity metadata and `tools/list` cache hints.

## Files and resource limits

- [x] Local upload is disabled without `OPENSOLAR_UPLOAD_ROOT`.
- [x] Upload path resolution prevents escape from the configured root, including through symlinks.
- [x] Private-file and system-image bodies are capped at 10 MB.
- [x] Binary file bytes are not duplicated into `structuredContent`.
- [x] Raw Data decompression has a fixed output limit.

## Docker

- [x] The Docker image builds successfully.
- [x] The runtime process is non-root.
- [x] Health/readiness work on a non-default container port.
- [x] MCP authentication is enforced.
- [x] The image exposes the 32-tool default profile.
- [x] The image carries OCI labels and the `io.modelcontextprotocol.server.name` label.

## Metadata and documentation

- [x] `package.json`, server-reported version, and `server.json` use `0.1.0`.
- [x] MCP Registry metadata passes `pnpm check:registry`.
- [x] `server.json` validates against the official 2025-12-11 `server.schema.json`.
- [x] `server.json` title, description, and website match the server's `serverInfo`.
- [x] README installation and configuration examples match the shipped CLI.
- [x] Public documentation contains no live organisation/project identifiers or credentials.
- [x] `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, and `CHANGELOG.md` are present.
- [x] Issue forms, a pull request template, and Dependabot configuration are present.
- [x] API contracts and live-verification status are recorded under `docs/`.

## OpenSolar behavior

- [x] Registered tools use documented OpenSolar API endpoints, local composition over documented reads, or recorded live verification.
- [x] All OpenSolar API pages were re-checked against the implementation on 2026-09-23 (see [source-log.md](./source-log.md)).
- [x] Raw Data-only tools can be removed with `OPENSOLAR_PLAN=api_access`.
- [x] Mutation tools with insufficiently established request contracts are not registered.
- [x] OpenSolar throttle behavior and access-plan requirements are documented.
- [x] The package is self-hosted and does not provide a shared OpenSolar credential service.

## Publication

- [ ] Publish `@alignco/opensolar-mcp@0.1.0` to npm.
- [ ] Verify the published npm package and package ownership.
- [ ] Publish matching MCP Registry metadata.
- [ ] Create the matching `v0.1.0` tag and GitHub release, using the `0.1.0` changelog entry as release notes.
- [ ] Enable GitHub private vulnerability reporting for the repository.

Any future shared or multi-customer hosted service is a separate deployment model and is not part of the `0.1.0` release.
