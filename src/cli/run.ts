import { parseFlags, resolveHttpBind } from '../lib/config.js';
import { serveHttp } from '../transports/http.js';
import { serveStdioTransport } from '../transports/stdio.js';
import { runCheck } from './check.js';
import { HELP_TEXT } from './help.js';
import { runListTools } from './list-tools.js';

export async function runCli(argv: string[]): Promise<void> {
  const flags = parseFlags(argv);

  if (flags.help) {
    process.stdout.write(HELP_TEXT);
    return;
  }

  if (flags.check) {
    await runCheck({ probe: flags.probe });
    return;
  }

  if (flags.listTools) {
    runListTools();
    return;
  }

  if (flags.http || process.env.MCP_TRANSPORT === 'http') {
    serveHttp(resolveHttpBind(flags));
    return;
  }

  serveStdioTransport();
}
