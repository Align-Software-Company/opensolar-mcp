# @alignco/opensolar-mcp

Unofficial Model Context Protocol server for the [OpenSolar API](https://developers.opensolar.com/api/).

This package is not affiliated with, endorsed by, or maintained by OpenSolar Pty Ltd. You run the process on your own machine or in your own hosting account, with your own OpenSolar token. This project does not host a shared server.

## Requirements

- Node.js 24
- An OpenSolar organisation with paid [API Access](https://developers.opensolar.com/api/api-access-plans/)
- `OPENSOLAR_API_TOKEN` and `OPENSOLAR_ORG_ID`

Normal OpenSolar user tokens expire after 7 days. A dedicated machine user does not expire. This server will not set `is_machine_user` for you. Stay inside the published [throttle limits](https://developers.opensolar.com/api/throttle/).

## Install

```bash
pnpm install
pnpm build
```

`--list-tools` does not need credentials:

```bash
node dist/index.js --list-tools
```

`--check --no-probe` needs the token and org id:

```bash
export OPENSOLAR_API_TOKEN=your_token
export OPENSOLAR_ORG_ID=12345
node dist/index.js --check --no-probe
```

Copy `.env.example` if you want a local env file. Integration tests load gitignored `.env.local`.

## Tools

The registered full surface is 75 tools. The default `OPENSOLAR_PROFILE=agent` exposes a smaller operational subset. `OPENSOLAR_PROFILE=full` exposes every registered tool, still subject to `OPENSOLAR_READ_ONLY` and `OPENSOLAR_PLAN`. An explicit `OPENSOLAR_TOOLSETS` list overrides profile membership and can include a toolset the agent profile leaves out.

Registered tools, in full-profile `--list-tools` order:

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

`OPENSOLAR_READ_ONLY=1` omits every registered create, update, and delete. The reads stay. Phase 4 writes on that list are `delete_module_activation`, `delete_inverter_activation`, `delete_battery_activation`, `delete_other_component_activation`, `create_workflow`, `delete_workflow`, `delete_payment_option`, `delete_pricing_scheme`, and `delete_costing`. Phase 5 writes are `create_private_file`, `update_private_file`, `delete_private_file`, `generate_project_document`, and `get_system_image`. `get_system_image` is omitted because the first call can create a private file. Phase 6 writes are `create_webhook` and `update_webhook`. There is no webhook delete. Phase 7 writes are `create_connection_request`, `accept_connection_request`, `update_connection`, `delete_connection`, `share_project`, `share_entities`, and `create_permission_role`.

`search_projects` and `search_contacts` page those documented lists and match locally. They do not send an OpenSolar `search` query. OpenSolar does not document those two MCP tools. `documented` in the contract matrix names the list GET each one pages.

`get_project_snapshot` reads one project together with its workflow, systems, and file metadata. A section that fails comes back as a gap. `update_project_stage` accepts a stage id or a stage title. A title that matches two stages is not patched.

`compare_project_systems` returns the columns each system payload actually has and does not pick a winner. `get_project_design` takes an optional section. `components` and `energy` stay unmapped until the decompress section names those keys. `OPENSOLAR_PLAN=api_access` still omits `get_project_design`.

`preflight_project_share` reads the connection list, the project, one systems page, and filtered entity lists. It does not share the project or any entity. `connection` is `ready` only when `is_active`, `is_other_active`, and `is_other_enabled` are all true. A filtered `shared_with` list decides whether a referenced payment option, pricing scheme, costing, or module activation is shared. An unfinished list stays `unknown`.

Catalog activation creates, `create_pricing_scheme`, `create_payment_option`, `create_costing`, `update_workflow`, and `update_org` are not registered. A write stays unsupported when its request contract has not been established with sufficient confidence. The contract may be established through sufficient official OpenSolar documentation or deliberate live verification recorded in the API contract and quirk docs. Absence of an example request alone does not make an operation unsupported. The public release checklist is not done.

Filter the surface with `OPENSOLAR_PROFILE` or `OPENSOLAR_TOOLSETS`. `OPENSOLAR_PLAN=api_access` omits `get_proposal_data` and `get_project_design` from whichever profile or toolset list is active. Default `--list-tools` prints the agent profile. `OPENSOLAR_PROFILE=full node dist/index.js --list-tools` prints all 75.

## Cursor (stdio)

In MCP settings, point at the built binary:

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

## Claude Desktop (stdio)

Same command, in Claude Desktop's MCP config (`claude_desktop_config.json`):

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

## HTTP

Default bind is loopback:

```bash
node dist/index.js --http
```

That serves Streamable HTTP at `http://127.0.0.1:3000/mcp`, plus `/health` and `/ready`. Pass the OpenSolar token as `Authorization: Bearer` on each request, or set `OPENSOLAR_API_TOKEN`.

Binding a public interface (`0.0.0.0` or `::`) requires `MCP_HTTP_ALLOWED_HOSTS` so DNS-rebinding protection can allow your hostname:

```bash
MCP_HTTP_ALLOWED_HOSTS=mcp.example.com node dist/index.js --http --host 0.0.0.0
```

## Docker

Build a Node 24 image that runs the HTTP server. Default bind inside the container is still loopback (`127.0.0.1:3000`). Publish a host port only after setting `MCP_HTTP_HOST=0.0.0.0` and `MCP_HTTP_ALLOWED_HOSTS`. Deploy this image in an account you control. This project does not operate a shared server.

```bash
docker build -t opensolar-mcp .
docker run --rm \
  -e OPENSOLAR_API_TOKEN=your_token \
  -e OPENSOLAR_ORG_ID=12345 \
  -e MCP_HTTP_HOST=0.0.0.0 \
  -e MCP_HTTP_ALLOWED_HOSTS=localhost \
  -p 3000:3000 \
  opensolar-mcp
```

Health:

```bash
curl http://127.0.0.1:3000/health
```

## License

MIT. See `LICENSE`.
