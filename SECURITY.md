# Security Policy

## Supported versions

OpenSolar MCP is prerelease software. Security fixes are applied to the current codebase and, when releases are available, to the latest published release.

| Version | Support |
| --- | --- |
| Latest code on `main` | Supported |
| Latest published release | Supported |
| Older prerelease snapshots | Best effort |

## Reporting a vulnerability

Do not disclose credentials, customer data, signed file URLs, or working exploit details in a public issue.

Use GitHub private vulnerability reporting when it is available for this repository. If that option is unavailable, open a minimal public issue requesting a private contact path without including sensitive details.

A useful report includes:

- the affected version or commit;
- the transport or subsystem involved;
- the affected tool, endpoint, or configuration;
- reproduction steps using synthetic data;
- the security impact.

## Security model

OpenSolar MCP is self-hosted software. It does not provide a shared OpenSolar credential service or operate a multi-customer OpenSolar proxy.

### Credentials

- OpenSolar bearer tokens are secrets.
- Stdio reads `OPENSOLAR_API_TOKEN` from the local process environment.
- Loopback HTTP may use the environment token as a local fallback.
- Non-loopback HTTP requires `Authorization: Bearer <token>` on every MCP request and does not use the environment token as a request fallback.
- Tokens are not intentionally written to disk or included in normal logs.

### HTTP transport

- Host allowlisting protects against DNS-rebinding-style Host manipulation.
- Browser Origin allowlisting is a separate control.
- Neither control replaces authentication.
- The built-in server uses plain HTTP. Internet-facing deployments must terminate TLS at a trusted reverse proxy or hosting platform.
- `/health` and `/ready` expose process status only and do not require an OpenSolar token.

### Mutations

Mutation tools operate on the configured live OpenSolar organisation.

- `OPENSOLAR_READ_ONLY=1` removes registered mutation tools.
- Writes are not automatically retried.
- Mutation annotations identify read/write and destructive behavior.
- Search results are not treated as a confirmed target unless the bounded scan reports `resolution: unique`.

### Local files

`create_private_file` is disabled unless `OPENSOLAR_UPLOAD_ROOT` is configured. Resolved file paths must remain inside that root, including through symlinks.

Private-file downloads and system images are capped at 10 MB. Signed download URLs are not returned to the model.

### Resource limits

Compressed Raw Data expansion is bounded before JSON parsing. Model-facing text from private files is truncated at a fixed limit. Ordinary JSON GET retries are bounded; writes and file transfers are not automatically retried.

## Out of scope

The following are deployment responsibilities rather than vulnerabilities in this package:

- protecting the host operating system and environment variables;
- securing the reverse proxy, TLS certificates, network perimeter, and container platform;
- OpenSolar account permissions and token issuance;
- security of third-party MCP clients that receive tool output.

Reports that demonstrate a package-level bypass of the documented boundaries above are in scope.
