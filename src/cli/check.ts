import { z } from 'zod';
import { createClient, OpenSolarApiError } from '../client/index.js';
import { ConfigError, loadConfig } from '../lib/config.js';

const OrgProbeSchema = z.object({ id: z.number() }).passthrough();

export async function runCheck(options: { probe: boolean }): Promise<void> {
  const config = loadConfig();

  if (!options.probe) {
    process.stdout.write('opensolar-mcp: configuration ok\n');
    return;
  }

  const client = createClient({
    token: config.OPENSOLAR_API_TOKEN,
    baseUrl: config.BASE_URL,
  });

  try {
    const raw = await client.get(`orgs/${config.OPENSOLAR_ORG_ID}/`);
    const parsed = OrgProbeSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ConfigError('OpenSolar org probe returned an unexpected payload.');
    }
    process.stdout.write(`opensolar-mcp: configuration ok (org ${parsed.data.id} reachable)\n`);
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    if (error instanceof OpenSolarApiError) {
      throw new ConfigError(
        `OpenSolar auth/org probe failed: HTTP ${error.status}. Check OPENSOLAR_API_TOKEN and OPENSOLAR_ORG_ID.`,
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigError(`OpenSolar auth/org probe failed: ${message}`);
  }
}
