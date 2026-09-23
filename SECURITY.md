# Security Policy

## Supported versions

OpenSolar MCP is currently prerelease software.

| Version | Supported |
| --- | --- |
| Latest code on `main` | Yes |
| Latest published release | Yes, once published |
| Older prerelease snapshots | Best effort |

Security fixes may require upgrading to the latest release.

## Reporting a vulnerability

Please do not disclose credentials, customer data, or a working exploit in a public issue.

If GitHub shows **Report a vulnerability** for this repository under the Security tab, use that private reporting channel. If private vulnerability reporting is unavailable, open a minimal issue that contains no sensitive details and asks the maintainers for a private contact path.

Include, when possible:

- the affected version or commit;
- the transport involved (stdio or HTTP);
- the impacted tool or subsystem;
- reproduction steps that do not expose real OpenSolar credentials or customer data;
- the security impact you believe is possible.

Do not include a live OpenSolar bearer token, organisation ID, customer record, signed file URL, or other production secret.

## Security model

This package is a self-hosted MCP client for the documented OpenSolar API. It does not operate a shared credential or multi-customer service.

### Credentials

- OpenSolar bearer tokens are secrets.
- Stdio uses `OPENSOLAR_API_TOKEN` from the local process environment.
- Loopback HTTP may use that environment token as a local fallback.
- Non-loopback HTTP deliberately ignores the environment-token fallback and requires `Authorization: Bearer <OpenSolar token>` on each MCP request.
- Credentials are not intentionally persisted by the server.
- Known credential-like values are redacted from model-facing structured output.

### Remote HTTP

`MCP_HTTP_ALLOWED_HOSTS` and `MCP_HTTP_ALLOWED_ORIGINS` reduce Host/DNS-rebinding and browser-Origin risk. They are not authentication.

The built-in server speaks plain HTTP. Internet-facing deployments should terminate TLS at a trusted reverse proxy or hosting platform before transmitting an OpenSolar bearer token.

`/health` and `/ready` are unauthenticated process-status endpoints and should not expose customer data or credentials.

### Mutations

An authorized MCP client can expose tools that change the live OpenSolar organisation.

- `OPENSOLAR_READ_ONLY=1` removes registered mutation tools.
- Writes are not automatically retried.
- Bounded entity searches confirm a target only when `resolution: unique`.
- Insufficiently established OpenSolar write contracts are deliberately not registered.

A client intentionally invoking an exposed mutation with valid OpenSolar credentials is not, by itself, a vulnerability.

### Local files

`create_private_file` is disabled unless `OPENSOLAR_UPLOAD_ROOT` is configured.

Resolved file paths must remain within that root, including through symlinks. Private-file downloads are size-bounded, and binary data is returned through MCP content/resource blocks rather than duplicated into structured JSON.

### Resource limits

The server applies bounded pagination, download limits, retry limits, and a decompressed-output limit for compressed Raw Data payloads. Reports of ways to bypass those limits are in scope.

## Out of scope

The following generally are not security vulnerabilities in this repository:

- OpenSolar service availability or behavior outside this client's control;
- a user intentionally giving an untrusted agent valid credentials and mutation access;
- failures that require an already-compromised host running the MCP server;
- unsupported or undocumented OpenSolar behavior that this server does not expose.

Security issues in OpenSolar itself should be reported to OpenSolar through its own channels.
