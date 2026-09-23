import { describe, expect, it } from 'vitest';
import { messageForOpenSolarError } from '../../src/client/errors.js';
import { OpenSolarApiError } from '../../src/client/index.js';
import { buildServer } from '../../src/server.js';
import { ALL_TOOL_FILTERS, testClient, withMcpClient } from '../helpers/mcp.js';

const deniedBody = 'denied-secret';

function errorClient(status: number) {
  return testClient(async () => {
    throw new OpenSolarApiError(
      `OpenSolar API ${status} on GET orgs/1/projects/`,
      status,
      deniedBody,
    );
  });
}

function toolText(result: {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}): string {
  const block = result.content[0];
  if (block?.type !== 'text' || typeof block.text !== 'string') {
    throw new Error('expected text content');
  }
  return block.text;
}

describe('sanitized tool errors', () => {
  it.each([
    [401, 'Token missing or expired. Normal tokens last 7 days. A machine user does not expire'],
    [403, 'The caller cannot use this record. OpenSolar uses 403 even when the record exists'],
    [429, 'Throttled. Wait. Do not loop'],
    [504, 'Timed out. Large projects can time out upstream. Do not loop'],
  ] as const)('maps HTTP %s to isError text without the upstream body', async (status, expected) => {
    const mcp = buildServer({
      client: errorClient(status),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'list_projects', arguments: {} }),
    );
    const text = toolText(result);

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(text).toBe(expected);
    expect(text).not.toContain(deniedBody);
    expect(messageForOpenSolarError(new OpenSolarApiError('x', status, deniedBody))).not.toContain(
      deniedBody,
    );
  });
});
