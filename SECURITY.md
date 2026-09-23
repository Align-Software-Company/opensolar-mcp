# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x (latest release) | Yes |
| `main` | Yes |
| Earlier prerelease snapshots | Best effort |

## Reporting a vulnerability

**Please do not report security problems in public issues, discussions, or pull requests.**

Report them privately through [GitHub private vulnerability reporting](https://github.com/Align-Software-Company/opensolar-mcp/security/advisories/new). If that is unavailable to you, open a minimal public issue asking for a private contact path, without any technical details.

A useful report includes:

- the affected version or commit;
- the transport or subsystem involved;
- the affected tool, endpoint, or configuration;
- reproduction steps that use synthetic data;
- the impact you observed or expect.

Never include OpenSolar tokens, organisation or project IDs, customer data, or signed file URLs. Replace them with placeholders.

We will acknowledge your report, keep you informed while we investigate, and credit you in the advisory unless you prefer otherwise.

## Security model

OpenSolar MCP is self-hosted software. It does not provide a shared OpenSolar credential service or operate a multi-customer OpenSolar proxy.

### Credentials

- OpenSolar bearer tokens are secrets.
- Over stdio, the server reads `OPENSOLAR_API_TOKEN` from its own process environment.
- Loopback HTTP may use the environment token as a local fallback.
- Non-loopback HTTP requires `Authorization: Bearer <token>` on every MCP request and never falls back to the environment token. A malformed `Authorization` header is rejected.
- The server does not intentionally write tokens to disk or include them in logs.

### HTTP transport

- In HTTP mode the bearer token sent by the client **is the OpenSolar API token**, which the server forwards to OpenSolar. It is not an MCP OAuth access token issued for this server. Anyone who can reach the endpoint with a valid OpenSolar token can act as that OpenSolar user, so treat the endpoint like the OpenSolar API itself. If several people share one deployment, put an authenticating gateway in front of it.
- Host allowlisting protects against DNS rebinding. Browser Origin allowlisting is a separate control. Neither replaces authentication.
- The built-in server speaks plain HTTP. Internet-facing deployments must terminate TLS at a trusted reverse proxy or hosting platform.
- `/health` and `/ready` return process status only and do not require a token.

### Mutations

Mutation tools act on the configured live OpenSolar organisation.

- `OPENSOLAR_READ_ONLY=1` removes every registered mutation tool. Unrecognized values stop startup rather than leaving writes enabled.
- Writes are never retried automatically.
- Tool annotations mark read-only, mutating, and destructive behavior.
- A search result is treated as a confirmed target only when the bounded scan reports `resolution: unique`.

### Local files

`create_private_file` is disabled unless `OPENSOLAR_UPLOAD_ROOT` is configured. Resolved real paths must stay inside that root, including through symlinks, and the model never supplies file bytes.

Private-file downloads and system images are capped at 10 MB. Signed download URLs are not returned to the model.

### Resource limits

Compressed Raw Data expansion is bounded before JSON parsing. Model-facing text from private files is truncated at a fixed limit. Searches stop at a fixed page limit. Only ordinary JSON reads retry, and only on HTTP 429.

## Out of scope

These are deployment responsibilities rather than vulnerabilities in this package:

- protecting the host operating system, its environment variables, and MCP client configuration files;
- the reverse proxy, TLS certificates, network perimeter, and container platform;
- OpenSolar account permissions and token issuance;
- the security of MCP clients and models that receive tool output.

Reports that demonstrate a bypass of the boundaries described above are in scope.
