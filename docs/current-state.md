# Current implementation

This document summarizes the behavior shipped by OpenSolar MCP `0.1.0`.

Last reviewed: 2026-09-23

## Package

| Item | Value |
| --- | --- |
| Package | `@alignco/opensolar-mcp` |
| Version | `0.1.0` |
| Runtime | Node.js 24+ |
| Module format | ESM |
| Package manager | pnpm |
| License | MIT |
| Default transport | stdio |
| Optional transport | Streamable HTTP |
| Default profile | `agent` |
| Registered tools | 75 |
| Default tools | 32 |

The server version is read from `package.json` at runtime so package metadata and the MCP server identity stay aligned.

## Tool exposure

Tool exposure is controlled by [`src/lib/tier-policy.ts`](../src/lib/tier-policy.ts) and [`src/tools/index.ts`](../src/tools/index.ts).

| Setting | Behavior |
| --- | --- |
| `OPENSOLAR_PROFILE=agent` | Curated 32-tool default surface |
| `OPENSOLAR_PROFILE=full` | All 75 registered tools |
| `OPENSOLAR_TOOLSETS=...` | Exposes complete selected functional toolsets |
| `OPENSOLAR_READ_ONLY=1` | Removes registered mutation tools |
| `OPENSOLAR_PLAN=api_access` | Removes Raw Data-only tools |

Toolsets and registered counts:

| Toolset | Count |
| --- | ---: |
| projects | 9 |
| org | 3 |
| contacts | 6 |
| events | 2 |
| systems | 5 |
| components | 12 |
| workflow | 4 |
| payment | 3 |
| pricing | 3 |
| costing | 3 |
| reference | 2 |
| files | 6 |
| webhooks | 5 |
| teams | 10 |
| raw_data | 2 |
| **Total** | **75** |

The CLI `--list-tools` command reports the effective surface after profile, toolset, read-only, and plan filtering.

## Transports and authentication

### Stdio

Stdio uses `OPENSOLAR_API_TOKEN` and `OPENSOLAR_ORG_ID` from the process environment. Logs are written to stderr so stdout remains protocol-only.

### Streamable HTTP

The HTTP transport is stateless and exposes:

- the MCP endpoint at the configured `MCP_HTTP_PATH`;
- `/health`;
- `/ready`.

Loopback HTTP may use `OPENSOLAR_API_TOKEN` as a local fallback. Non-loopback HTTP requires an OpenSolar Bearer token on every MCP request and ignores the environment token as a request fallback.

Wildcard binds require `MCP_HTTP_ALLOWED_HOSTS`. Browser-Origin filtering is configured independently with `MCP_HTTP_ALLOWED_ORIGINS` and defaults to the Host allowlist on non-loopback binds.

The built-in server does not terminate TLS.

## Client behavior

[`src/client/index.ts`](../src/client/index.ts) provides JSON GET, POST, PUT, PATCH, DELETE, multipart upload, authenticated file GET, and unauthenticated signed-file download.

Key behavior:

- default timeout: 30 seconds;
- system details and system image: 120-second timeout;
- ordinary JSON GET: at most three attempts on HTTP 429;
- writes: one attempt;
- file GETs, downloads, and uploads: one attempt;
- JSON write methods add a trailing slash when needed;
- empty response body becomes `null`;
- non-JSON bodies on JSON operations produce a controlled API error.

A `Retry-After` value is honored only when the wait is at most five seconds. Without it, retry delays are 200 ms and 400 ms.

## Search and target resolution

`search_projects` and `search_contacts` scan documented list endpoints locally rather than sending an undocumented server-side search query.

Search results include pages scanned, records scanned, completion status, truncation status, and a resolution value.

| Resolution | Meaning |
| --- | --- |
| `unique` | Complete scan with exactly one match |
| `none` | Complete scan with no matches |
| `ambiguous` | More than one match observed, or matching results were truncated |
| `incomplete` | Scan ended before uniqueness could be established |

Only `unique` confirms a mutation target.

## Data curation and redaction

Default reads return curated objects rather than raw OpenSolar payloads. Sensitive and oversized fields are omitted or redacted before model-facing output.

Examples include:

- project `design` blobs;
- integration credentials and API keys;
- webhook signing secrets;
- e-signature and financing integration secrets;
- passport, licence, and date-of-birth fields;
- payment and pricing `configuration_json`;
- component bulk data not required by the tool.

`get_project`, `get_org`, and selected list paths support verbose redacted output where documented.

## Files

Private-file metadata omits the signed download URL.

`get_private_file(include_contents: true)`:

- refuses a body over 10 MB;
- caps model-facing text at 100,000 characters;
- returns images as MCP image content;
- returns PDFs with extracted text plus an embedded PDF resource;
- returns other binary files as embedded resources;
- does not duplicate binary bytes into `structuredContent`.

`create_private_file` is disabled until `OPENSOLAR_UPLOAD_ROOT` is configured. Real paths are resolved before use and must remain inside that root.

## Raw Data tools

`get_proposal_data` and `get_project_design` require Raw Data API Access.

Compressed JSON expansion is limited to 64 MB before parsing.

`get_project_design` exposes only documented or deliberately mapped sections. Geometry coordinates and compressed design blobs are not returned. Sections whose field names are not established remain explicitly unmapped.

## Composite and derived tools

The server includes several MCP-level operations built from documented OpenSolar reads:

- `search_projects`
- `search_contacts`
- `get_project_snapshot`
- `compare_project_systems`
- `preflight_project_share`
- `get_project_design`

These tools do not create undocumented OpenSolar endpoints. Their upstream calls are recorded in [api-contract-matrix.md](./api-contract-matrix.md).

`compare_project_systems` presents comparable fields without ranking systems.

`preflight_project_share` is read-only. Incomplete or unsupported evidence is reported as `unknown`, not treated as permission to share.

## Unsupported write contracts

Some documented OpenSolar endpoint families are not registered because the available documentation does not establish a sufficiently clear write contract:

- create module activation;
- create inverter activation;
- create battery activation;
- create other-component activation;
- create pricing scheme;
- create payment option;
- create costing;
- update workflow;
- update organisation.

The evidence status for these operations is maintained in [api-contract-matrix.md](./api-contract-matrix.md) and [source-log.md](./source-log.md).

## Testing and release checks

`pnpm check:all` runs repository hygiene checks, Registry metadata checks, linting, type checking, and the offline test suite.

Live OpenSolar checks are isolated under `pnpm test:integration`. Credentials alone enable read-only checks; live writes require `OPENSOLAR_INTEGRATION_WRITES=1` and, where applicable, dedicated fixture IDs.

CI also:

- builds the package;
- packs the npm artifact;
- installs the tarball into a clean temporary project;
- smoke-tests stdio and HTTP;
- verifies the effective tool surfaces;
- checks remote HTTP authentication behavior;
- builds and smoke-tests the Docker image.

See [release-checklist.md](./release-checklist.md) for the release gate.

## Related documentation

- [API contract matrix](./api-contract-matrix.md)
- [API quirks](./api-quirks.md)
- [Source log](./source-log.md)
- [Default profile evaluation](./agent-profile-evaluation.md)
- [Release checklist](./release-checklist.md)
- [Release constraints](./terms-release-gate.md)
