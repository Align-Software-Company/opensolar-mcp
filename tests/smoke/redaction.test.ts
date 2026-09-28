import { describe, expect, it } from 'vitest';
import { redactSensitive } from '../../src/lib/redaction.js';
import { buildServer } from '../../src/server.js';
import { loadOpenSolarFixture } from '../fixtures/load-fixture.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

describe('redactSensitive', () => {
  it('redacts generic secret keys and keeps token_type', () => {
    expect(
      redactSensitive({
        token: 'abc',
        api_key: 'k',
        nested: { refresh_token: 'r', token_type: 'Bearer' },
      }),
    ).toEqual({
      token: '[REDACTED]',
      api_key: '[REDACTED]',
      nested: { refresh_token: '[REDACTED]', token_type: 'Bearer' },
    });
  });

  it('redacts signed file contents and keeps the file title', () => {
    expect(
      redactSensitive({
        id: 1,
        private_files_data: [
          {
            id: 2,
            title: 'Site plan',
            file_contents: 'https://files.example.test/a.pdf?Expires=1&Signature=x',
          },
        ],
      }),
    ).toEqual({
      id: 1,
      private_files_data: [{ id: 2, title: 'Site plan', file_contents: '[REDACTED]' }],
    });
  });

  it('redacts a signed URL stored in another string', () => {
    expect(
      redactSensitive({
        note: 'https://files.example.test/a.pdf?X-Amz-Signature=abc',
      }),
    ).toEqual({ note: '[REDACTED]' });
  });
});

describe('verbose get_project', () => {
  it('omits a signed private-file URL', async () => {
    const project = loadOpenSolarFixture('projects', 'detail-with-files');
    const mcp = buildServer({
      client: testClient(async () => project),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });
    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'get_project', arguments: { id: 1001, verbose: true } }),
    );
    const payload = requireStructuredContent(result);
    expect(JSON.stringify(result)).not.toContain('Signature=x');
    expect(JSON.stringify(payload)).toContain('Site plan');
  });
});
