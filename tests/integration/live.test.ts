import { describe, expect, it } from 'vitest';
import { createClient } from '../../src/client/index.js';
import { loadConfig } from '../../src/lib/config.js';
import { hasLiveOpenSolarCredentials, loadLocalEnv } from '../load-local-env.js';

loadLocalEnv();

const live = hasLiveOpenSolarCredentials();

describe.skipIf(!live)('live OpenSolar', () => {
  it('reads the configured org with credentials from .env.local', async () => {
    const config = loadConfig();
    const client = createClient({
      token: config.OPENSOLAR_API_TOKEN,
      baseUrl: config.BASE_URL,
    });
    const org = await client.get(`orgs/${config.OPENSOLAR_ORG_ID}/`);

    expect(org).toEqual(expect.objectContaining({ id: config.OPENSOLAR_ORG_ID }));
  });
});
