import { runCli } from './cli/run.js';
import { ConfigError } from './lib/config-error.js';
import { log } from './lib/log.js';

async function main(): Promise<void> {
  await runCli(process.argv.slice(2));
}

main().catch((err: unknown) => {
  if (err instanceof ConfigError) {
    log.error(err.message);
    process.exit(1);
  }
  const message = err instanceof Error ? err.message : String(err);
  log.error('startup failed', { error: message });
  process.exit(1);
});
