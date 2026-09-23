# Release checklist

Technical readiness is separate from a decision to publish or to host a shared service.

Last reviewed: 2026-09-23

The package version under review is `0.1.0-rc.1`. This checklist does not publish it.

## Technical artifact

- [x] `pnpm check:all` is green. That suite does not call OpenSolar.
- [x] `pnpm build` is green.
- [x] `npm pack` contents are `package.json`, `README.md`, `LICENSE`, and `dist/`.
- [x] A clean `npm install` of the tarball runs `--help`, the 32-tool agent profile, the 75-tool full profile, the five webhook tools, and rejects an unknown profile.
- [x] The installed binary completes stdio `initialize`, `tools/list`, and one read (`get_org`) against a local mock. Logs stay on stderr.
- [x] The installed binary serves `/health` and `/ready`, initializes Streamable HTTP, and lists the agent profile. Binding `0.0.0.0` without `MCP_HTTP_ALLOWED_HOSTS` fails closed.
- [x] Docker image `opensolar-mcp:rc` starts, the healthcheck becomes healthy, and `/health`, `/ready`, and the MCP endpoint answer. `MCP_HTTP_HOST=0.0.0.0` with `MCP_HTTP_ALLOWED_HOSTS=127.0.0.1` is reachable from the host. The image was not pushed.
- [x] GitHub Dependabot reports 0 open alerts on 2026-09-23.
- [x] The tarball does not contain `.env`, `.env.local`, `dev-docs/`, eval runs, tests, fixtures, source-log material, git metadata, or a local OpenSolar token. README mentions `.env.local` and `OPENSOLAR_API_TOKEN=` only as setup instructions.

`prepack` runs `pnpm check:all && pnpm build`. Packaging does not need `OPENSOLAR_API_TOKEN` or `OPENSOLAR_ORG_ID` and does not call OpenSolar.

## OpenSolar/API

- [x] Tools call the official OpenSolar API only.
- [x] Throttle behavior is documented. Reads retry a bounded 429. Writes are not retried.
- [x] Writes whose request contracts are not established stay unregistered.
- [x] The process is self-hosted. The caller brings their own token. There is no token vault and no multi-customer service.
- [x] Raw Data entitlement is documented. `OPENSOLAR_PLAN=api_access` omits `get_proposal_data` and `get_project_design`.

## Publication authorization

OpenSolar's current User Terms prohibit operating the platform as a proxy, aggregator, or third-party service interface without prior written consent (clause 17.7). Whether public distribution of this self-hosted package independently requires that consent is a human decision. This document does not make that legal conclusion.

- [ ] Public distribution reviewed/approved
- [ ] Managed/shared hosting remains disabled unless separately authorized

Do not `npm publish`, create a GitHub Release, or push a container image until those boxes are decided.
