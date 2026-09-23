import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readPackageVersion } from '../../src/lib/package-version.js';
import { buildServer } from '../../src/server.js';
import { unexpectedCallClient, withMcpClient } from '../helpers/mcp.js';

describe('server version', () => {
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
        version: manifest.version,
      });
    });
  });
});
