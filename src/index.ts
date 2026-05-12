import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { log } from './lib/log.js';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const stubbedSubcommand = args.find((arg) => arg === '--check' || arg === '--list-tools');
  if (stubbedSubcommand !== undefined) {
    log.error('subcommand not yet implemented in walking skeleton', {
      subcommand: stubbedSubcommand,
      hint: 'planned for v1; see dev-docs/directory.md src/cli/',
    });
    process.exit(1);
  }

  if (args.includes('--http') || process.env.MCP_TRANSPORT === 'http') {
    log.error('HTTP transport not yet implemented in walking skeleton', {
      hint: 'stdio transport only in v0.0.1; see dev-docs/decisions/001-dual-transport.md',
    });
    process.exit(1);
  }

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info('opensolar-mcp ready', { transport: 'stdio' });
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  log.error('startup failed', { error: message });
  process.exit(1);
});
