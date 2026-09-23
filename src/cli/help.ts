export const HELP_TEXT = `Usage: opensolar-mcp [options]

Unofficial MCP server for the OpenSolar API.

Transports:
  (default)              Serve MCP over stdio
  --http                 Serve MCP over Streamable HTTP
  --host <host>          HTTP bind host (default: 127.0.0.1)
  --port <port>          HTTP bind port (default: 3000)
  --path <path>          MCP HTTP path (default: /mcp)

Commands:
  --check                Validate config and credentials
  --probe                With --check, GET /orgs/:id/ (default)
  --no-probe             With --check, skip the live org probe
  --list-tools           Print the effective tool surface
  --help, -h             Show this help

Environment:
  OPENSOLAR_API_TOKEN    Bearer token (required for stdio and --check)
  OPENSOLAR_ORG_ID       Org id (required for stdio, HTTP, and --check)
  OPENSOLAR_BASE_URL     API base URL (default: https://api.opensolar.com/api/)
  OPENSOLAR_TOOLSETS     projects, org, contacts, events, systems, components, workflow, payment, pricing, costing, reference, files, webhooks, teams, raw_data
  OPENSOLAR_READ_ONLY    1/true/yes to hide mutation tools
  OPENSOLAR_PLAN         api_access or raw_data
  MCP_TRANSPORT          Set to http to serve HTTP
  MCP_HTTP_HOST          HTTP bind host
  MCP_HTTP_PORT          HTTP bind port
  MCP_HTTP_PATH          MCP HTTP path
  MCP_HTTP_ALLOWED_HOSTS Comma-separated Host values when binding 0.0.0.0 or ::
`;
