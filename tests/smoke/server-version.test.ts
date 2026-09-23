import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readPackageVersion } from '../../src/lib/package-version.js';
import {
  buildServer,
  SERVER_DESCRIPTION,
  SERVER_TITLE,
  SERVER_WEBSITE_URL,
} from '../../src/server.js';
import { unexpectedCallClient, withMcpClient } from '../helpers/mcp.js';

describe('server identity', () => {
  it('reports the version from package.json', async () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as {
      version: string;
    };
    expect(readPackageVersion()).toBe(manifest.version);

    const server = buildServer({
      client: unexpectedCallClient(),
      orgId: 1,
      filters: {
        profile: 'agent',
        toolsets: [],
        toolsetsExplicit: false,
        readOnly: true,
        plan: undefined,
      },
    });
    await withMcpClient(server, async (client) => {
      expect(client.getServerVersion()).toEqual({
        name: '@alignco/opensolar-mcp',
        title: SERVER_TITLE,
        description: SERVER_DESCRIPTION,
        version: manifest.version,
        websiteUrl: SERVER_WEBSITE_URL,
      });
    });
  });
});

describe('server identity metadata', () => {
  it('matches the MCP Registry metadata', () => {
    const registry = JSON.parse(
      readFileSync(new URL('../../server.json', import.meta.url), 'utf8'),
    ) as { title: string; description: string; websiteUrl: string };
    expect(SERVER_TITLE).toBe(registry.title);
    expect(SERVER_DESCRIPTION).toBe(registry.description);
    expect(SERVER_WEBSITE_URL).toBe(registry.websiteUrl);
  });
});
