# OpenSolar MCP

[![CI](https://github.com/Align-Software-Company/opensolar-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Align-Software-Company/opensolar-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

An unofficial, self-hosted [Model Context Protocol](https://modelcontextprotocol.io/) server for the documented [OpenSolar API](https://developers.opensolar.com/api/).

It gives MCP-capable agents a smaller operational tool surface by default, while retaining a full API-oriented surface for advanced use. OpenSolar credentials stay with the process or MCP client you control; this project does not operate a shared OpenSolar service.

> **Release status:** `0.1.0-rc.1` is a release candidate. The package is not yet published to npm.

This project is not affiliated with, endorsed by, or maintained by OpenSolar Pty Ltd.

## Features

- **Agent-oriented default:** 32 operational tools, selected from 75 registered tools.
- **Semantic workflows:** local project/contact search, project snapshots, stage-name resolution, system comparison, design projections, and project-share preflight.
- **Two transports:** stdio for local MCP clients and stateless Streamable HTTP for self-hosted deployments.
- **BYO OpenSolar access:** your OpenSolar organisation ID and API token; no token vault or account service.
- **Safer writes:** mutation tools are explicit, writes are never automatically retried, and uncertain write contracts stay unregistered.
- **Bounded reads:** ordinary JSON GET requests retry HTTP 429 at most three attempts with bounded backoff.
- **Redacted output:** known credentials and large/raw fields are removed or projected before they reach model context.
- **File safeguards:** private downloads are capped at 10 MB; local uploads are disabled unless an upload root is explicitly configured.

## Requirements

- Node.js **24 or newer**
- An OpenSolar organisation with paid [API Access](https://developers.opensolar.com/api/api-access-plans/)
- `OPENSOLAR_ORG_ID`
- An OpenSolar bearer token
- Raw Data API Access only if you want `get_proposal_data` or `get_project_design`

OpenSolar says normal user tokens expire after seven days; a dedicated machine user does not expire. This server does not change `is_machine_user` for you. Follow OpenSolar's published [throttle limits](https://developers.opensolar.com/api/throttle/).

## Quick start from source

The release candidate is not on npm yet, so build the current checkout:

```bash
git clone https://github.com/Align-Software-Company/opensolar-mcp.git
cd opensolar-mcp
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

List the default agent tools without credentials:

```bash
node dist/index.js --list-tools
```

Check local configuration without contacting OpenSolar:

```bash
export OPENSOLAR_API_TOKEN=your_token
export OPENSOLAR_ORG_ID=12345
node dist/index.js --check --no-probe
```

Run over stdio:

```bash
node dist/index.js
```

After npm publication, the intended package entry point will also be:

```bash
npx -y @alignco/opensolar-mcp --list-tools
```

or:

```bash
npm install -g @alignco/opensolar-mcp
opensolar-mcp --list-tools
```

## Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `OPENSOLAR_API_TOKEN` | OpenSolar bearer token. Required by stdio and `--check`. Loopback HTTP may also use it as a fallback. | none |
| `OPENSOLAR_ORG_ID` | OpenSolar organisation ID used in org-scoped endpoints. | required |
| `OPENSOLAR_BASE_URL` | OpenSolar API base URL. | `https://api.opensolar.com/api/` |
| `OPENSOLAR_PROFILE` | Tool profile: `agent` or `full`. | `agent` |
| `OPENSOLAR_TOOLSETS` | Comma-separated toolsets. When set, overrides profile membership. | unset |
| `OPENSOLAR_READ_ONLY` | `1`, `true`, `yes`, or `on` hides every registered mutation. | off |
| `OPENSOLAR_PLAN` | `api_access` hides Raw Data-only tools; `raw_data` keeps them. | unset |
| `OPENSOLAR_UPLOAD_ROOT` | Directory from which `create_private_file` may read local files. Uploads are disabled when unset. | unset |
| `MCP_TRANSPORT` | Set to `http` to use Streamable HTTP instead of stdio. | stdio |
| `MCP_HTTP_HOST` | HTTP bind host. | `127.0.0.1` |
| `MCP_HTTP_PORT` | HTTP port. | `3000` |
| `MCP_HTTP_PATH` | Streamable HTTP MCP path. | `/mcp` |
| `MCP_HTTP_ALLOWED_HOSTS` | Comma-separated Host values for non-loopback/wildcard binds. Required for `0.0.0.0` and `::`. | unset |
| `MCP_HTTP_ALLOWED_ORIGINS` | Optional browser Origin hostnames for non-loopback HTTP. Defaults to the Host allowlist. Requests without an Origin header still pass. | Host allowlist |

`OPENSOLAR_TOOLSETS`, when present, takes precedence over profile membership. `OPENSOLAR_READ_ONLY` and `OPENSOLAR_PLAN` are applied afterward.

Copy [`.env.example`](.env.example) for a reference configuration. The runtime does not automatically load `.env.local`; the live integration tests do.

## Tool profiles

| Surface | Count | Purpose |
| --- | ---: | --- |
| `agent` | 32 | Default operational surface for agents |
| `agent` + `OPENSOLAR_READ_ONLY=1` | 22 | Agent reads only |
| `agent` + `OPENSOLAR_PLAN=api_access` | 30 | Agent surface without Raw Data-only tools |
| `full` | 75 | Every registered tool before read-only/plan filtering |

Use the binary as the source of truth:

```bash
node dist/index.js --list-tools
OPENSOLAR_PROFILE=full node dist/index.js --list-tools
OPENSOLAR_TOOLSETS=webhooks node dist/index.js --list-tools
```

The default profile includes common project, contact, system, commercial configuration, file, Teams, and Raw Data workflows. Administrative catalog, workflow, webhook, delete, and other specialized primitives remain available through `full` or explicit toolsets.

<details>
<summary>Full toolsets</summary>

| Toolset | Tools |
| --- | --- |
| projects | `list_projects`, `search_projects`, `get_project`, `get_project_snapshot`, `create_project`, `update_project`, `update_project_stage`, `update_project_usage`, `delete_project` |
| org | `get_org`, `list_roles`, `get_role` |
| contacts | `list_contacts`, `search_contacts`, `get_contact`, `create_contact`, `update_contact`, `delete_contact` |
| events | `get_event`, `list_event_types` |
| systems | `list_project_systems`, `compare_project_systems`, `get_system`, `get_system_details`, `get_system_image` |
| components | `list_modules`, `get_module`, `delete_module_activation`, `list_inverters`, `get_inverter`, `delete_inverter_activation`, `list_batteries`, `get_battery`, `delete_battery_activation`, `list_other_components`, `get_other_component`, `delete_other_component_activation` |
| workflow | `list_workflows`, `get_workflow`, `create_workflow`, `delete_workflow` |
| payment | `list_payment_options`, `get_payment_option`, `delete_payment_option` |
| pricing | `list_pricing_schemes`, `get_pricing_scheme`, `delete_pricing_scheme` |
| costing | `list_costings`, `get_costing`, `delete_costing` |
| reference | `list_roof_types`, `list_file_tags` |
| files | `list_private_files`, `get_private_file`, `create_private_file`, `update_private_file`, `delete_private_file`, `generate_project_document` |
| webhooks | `list_webhooks`, `create_webhook`, `update_webhook`, `list_webhook_logs`, `list_webhook_queue` |
| teams | `list_connected_orgs`, `preflight_project_share`, `list_connection_requests`, `create_connection_request`, `accept_connection_request`, `update_connection`, `delete_connection`, `share_project`, `share_entities`, `create_permission_role` |
| raw_data | `get_proposal_data`, `get_project_design` |

</details>

Several documented OpenSolar write operations remain intentionally unregistered because their request contracts have not been established with sufficient confidence. The server does not guess write bodies.

## Connect over stdio

For local MCP clients, set the token and org ID in the server environment.

### Cursor

```json
{
  "mcpServers": {
    "opensolar": {
      "command": "node",
      "args": ["/absolute/path/to/opensolar-mcp/dist/index.js"],
      "env": {
        "OPENSOLAR_API_TOKEN": "your_token",
        "OPENSOLAR_ORG_ID": "12345"
      }
    }
  }
}
```

### Claude Desktop

```json
{
  "mcpServers": {
    "opensolar": {
      "command": "node",
      "args": ["/absolute/path/to/opensolar-mcp/dist/index.js"],
      "env": {
        "OPENSOLAR_API_TOKEN": "your_token",
        "OPENSOLAR_ORG_ID": "12345"
      }
    }
  }
}
```

## Streamable HTTP

Start a loopback server:

```bash
export OPENSOLAR_API_TOKEN=your_token
export OPENSOLAR_ORG_ID=12345
node dist/index.js --http
```

It serves:

- MCP: `http://127.0.0.1:3000/mcp`
- health: `/health`
- readiness: `/ready`

For loopback HTTP, an `Authorization: Bearer <token>` request header takes precedence over `OPENSOLAR_API_TOKEN`; the environment token may be used as a local fallback.

### Non-loopback / remote HTTP

A non-loopback HTTP server **requires the OpenSolar bearer token on each MCP request**. `OPENSOLAR_API_TOKEN` is deliberately ignored as an HTTP request fallback when the server is bound to a non-loopback address.

```bash
export OPENSOLAR_ORG_ID=12345
export MCP_HTTP_HOST=0.0.0.0
export MCP_HTTP_ALLOWED_HOSTS=mcp.example.com
node dist/index.js --http
```

Your MCP client then sends:

```http
Authorization: Bearer <your OpenSolar token>
```

Important:

- `MCP_HTTP_ALLOWED_HOSTS` protects Host handling / DNS rebinding. `MCP_HTTP_ALLOWED_ORIGINS` controls browser Origin hostnames and defaults to the Host allowlist on non-loopback binds. Neither is authentication.
- The built-in HTTP server is plain HTTP. Terminate TLS at a trusted reverse proxy or hosting platform before sending an OpenSolar token over the public internet.
- `/health` and `/ready` do not require the OpenSolar token and return only process status.
- A malformed `Authorization` header is rejected rather than falling back to an environment token.

## Docker

The image runs the Streamable HTTP transport.

The image runs as an unprivileged user and defaults to `MCP_HTTP_HOST=0.0.0.0` with `localhost,127.0.0.1` allowed as Host/Origin values. For a container reachable only from the local host:

```bash
docker build -t opensolar-mcp .
docker run --rm \
  -e OPENSOLAR_ORG_ID=12345 \
  -p 127.0.0.1:3000:3000 \
  opensolar-mcp
```

Because the process uses a non-loopback bind inside the container, the MCP client must send `Authorization: Bearer <OpenSolar token>`. The image healthcheck follows `MCP_HTTP_PORT` when you change the container port.

For an externally reachable deployment, configure the public Host allowlist similarly. Do not rely on `OPENSOLAR_API_TOKEN` as the remote HTTP credential:

```bash
docker run --rm \
  -e OPENSOLAR_ORG_ID=12345 \
  -e MCP_HTTP_ALLOWED_HOSTS=mcp.example.com \
  -p 3000:3000 \
  opensolar-mcp
```

The remote MCP client must send the OpenSolar bearer token in `Authorization`, and public traffic should be behind TLS.

## Local file uploads

`create_private_file` reads from the filesystem of the machine running this server. It is disabled by default.

Enable it by setting a directory:

```bash
export OPENSOLAR_UPLOAD_ROOT=/absolute/path/to/uploads
```

Relative tool paths resolve from that directory. Absolute paths are accepted only when their resolved real path remains inside it. Symlinks cannot be used to escape the configured root.

Private-file downloads and system images are capped at 10 MB. Text content may appear in structured output; images and other binary files use MCP content/resource blocks instead of duplicating their bytes into structured JSON.

## Safety and operational notes

- Mutation tools change the live OpenSolar organisation. Review consequential writes.
- `OPENSOLAR_READ_ONLY=1` removes every registered mutation from the exposed surface.
- Ordinary JSON GET requests retry HTTP 429 at most three attempts; writes, file GETs, downloads, and uploads are not automatically retried.
- Search tools use bounded local scans over documented list endpoints. An incomplete scan is not proof that a record does not exist.
- `preflight_project_share` is read-only; an `unknown` share/readiness state is not treated as safe.
- The package uses documented OpenSolar API endpoints and deliberately leaves insufficiently established writes unregistered.
- This repository distributes self-hosted software. It does not operate a shared or multi-customer OpenSolar service.

## Development

```bash
pnpm install --frozen-lockfile
pnpm check:all
pnpm build
pnpm test:docker
```

The ordinary test suite is offline and does not call OpenSolar.

Live integration tests use a gitignored `.env.local` (or `dev-docs/private/.env.local`) when credentials are present:

```bash
pnpm test:integration
```

Credentials alone run read-only live checks. Live mutation tests require:

```bash
OPENSOLAR_INTEGRATION_WRITES=1 pnpm test:integration
```

Some mutation/preflight cases also require dedicated fixture IDs; see [`.env.example`](.env.example).

Packaging runs the offline checks and build through `prepack`. CI also packs the npm artifact, installs/smoke-tests that tarball without contacting OpenSolar, and builds/smoke-tests the Docker image.

## Documentation

- [Current implementation](docs/current-state.md)
- [API contract matrix](docs/api-contract-matrix.md)
- [API quirks](docs/api-quirks.md)
- [Source log](docs/source-log.md)
- [Agent-profile evaluation](docs/agent-profile-evaluation.md)
- [Release checklist](docs/release-checklist.md)
- [Release constraints](docs/terms-release-gate.md)

## License

[MIT](LICENSE) © 2026 Align Software Company.
