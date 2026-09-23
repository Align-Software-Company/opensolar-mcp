import { describe, expect, it } from 'vitest';
import { createClient, OpenSolarApiError } from '../../src/client/index.js';
import { loadConfig } from '../../src/lib/config.js';
import { hasLiveOpenSolarCredentials, loadLocalEnv } from '../load-local-env.js';

loadLocalEnv();

const live = hasLiveOpenSolarCredentials();

function contactId(value: unknown): number {
  if (typeof value !== 'object' || value === null || !('id' in value)) {
    throw new Error('contact response missing id');
  }
  const id = value.id;
  if (typeof id !== 'number' || !Number.isInteger(id)) {
    throw new Error('contact response missing id');
  }
  return id;
}

describe.skipIf(!live)('live OpenSolar writes', () => {
  it('creates, updates, and deletes one fixture contact', async () => {
    const config = loadConfig();
    const client = createClient({
      token: config.OPENSOLAR_API_TOKEN,
      baseUrl: config.BASE_URL,
    });
    const orgId = config.OPENSOLAR_ORG_ID;
    const body = {
      first_name: 'Fixture',
      family_name: 'Contact',
      email: `opensolar-mcp-p3-06-${Date.now()}@example.test`,
      phone: '2025550197',
    };

    let createdId: number;
    try {
      createdId = contactId(await client.post(`orgs/${orgId}/contacts`, body));
    } catch (error) {
      if (error instanceof OpenSolarApiError) {
        throw new Error(`POST contacts failed with HTTP ${error.status}`);
      }
      throw error;
    }

    try {
      const updatedId = contactId(
        await client.put(`orgs/${orgId}/contacts/${createdId}`, {
          ...body,
          phone: '2025550196',
        }),
      );
      expect(updatedId).toBe(createdId);
    } catch (error) {
      if (error instanceof OpenSolarApiError) {
        throw new Error(`PUT contacts failed with HTTP ${error.status}`);
      }
      throw error;
    }

    try {
      await client.delete(`orgs/${orgId}/contacts/${createdId}`);
    } catch (error) {
      if (error instanceof OpenSolarApiError) {
        throw new Error(`DELETE contacts failed with HTTP ${error.status}`);
      }
      throw error;
    }
  });
});
