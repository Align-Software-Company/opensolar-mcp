import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createClient } from '../client/index.js';
import { loadConfig, loadToolFilters, loadUploadRoot } from '../lib/config.js';
import { log } from '../lib/log.js';
import { buildServer } from '../server.js';

export function serveStdioTransport(): void {
  const config = loadConfig();
  const filters = loadToolFilters();
  const baseUrl = config.BASE_URL;
  const orgId = config.OPENSOLAR_ORG_ID;
  const token = config.OPENSOLAR_API_TOKEN;
  const uploadRoot = loadUploadRoot();

  serveStdio(
    () => {
      const client = createClient({ token, baseUrl });
      return buildServer({ client, orgId, filters, uploadRoot });
    },
    {
      onerror: (error) => {
        log.error('stdio transport error', { error: error.message });
      },
    },
  );
  log.info('opensolar-mcp ready', { transport: 'stdio' });
}
