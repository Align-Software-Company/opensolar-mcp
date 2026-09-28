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
    [
      401,
      'Token missing or expired (HTTP 401). Standard OpenSolar tokens last 7 days; machine-user tokens do not expire. The operator must supply a new token, so retrying will not help.',
    ],
    [
      403,
      "The caller cannot use this record (HTTP 403). OpenSolar also returns 403 for records that exist but are outside this token's permissions or API Access entitlement, so do not treat it as not found.",
    ],
    [
      429,
      'Throttled by OpenSolar (HTTP 429). Limits are per user per minute, for example 10 project creates or updates per minute. Wait about a minute before retrying.',
    ],
    [
      504,
      "Timed out (HTTP 504). Large projects can exceed OpenSolar's upstream time limit, so an immediate identical retry is unlikely to help.",
    ],
  ] as const)(
    'maps HTTP %s to isError text without the upstream body',
    async (status, expected) => {
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
      expect(
        messageForOpenSolarError(new OpenSolarApiError('x', status, deniedBody)),
      ).not.toContain(deniedBody);
    },
  );

  it('includes a field error from an HTTP 400 body', () => {
    const text = messageForOpenSolarError(
      new OpenSolarApiError('x', 400, '{"email":["Enter a valid email address."]}'),
    );
    expect(text).toContain('email: Enter a valid email address.');
  });

  it('labels detail as request', () => {
    const text = messageForOpenSolarError(
      new OpenSolarApiError('x', 400, '{"detail":"Bad request"}'),
    );
    expect(text).toContain('request: Bad request');
  });

  it('redacts a JWT embedded in a validation message', () => {
    const text = messageForOpenSolarError(
      new OpenSolarApiError(
        'x',
        400,
        '{"token":["Invalid token eyJaaaaaaaaaaaa.eyJbbbbbbbbbbbb.cccccccccccc supplied."]}',
      ),
    );
    expect(text).not.toContain('eyJ');
    expect(text).toContain('[REDACTED]');
  });

  it('replaces URLs in validation messages', () => {
    const text = messageForOpenSolarError(
      new OpenSolarApiError('x', 422, '{"website":["See https://files.example.test/a"]}'),
    );
    expect(text).toContain('[url]');
    expect(text).not.toContain('https://');
  });

  it('hides a non-JSON HTTP 400 body', () => {
    expect(messageForOpenSolarError(new OpenSolarApiError('x', 400, '<html>'))).toBe(
      'OpenSolar rejected the request (HTTP 400).',
    );
  });

  it('warns that a timed-out write may have been applied', async () => {
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.post = async () => {
      throw new OpenSolarApiError('x', 504, '', 'POST');
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });
    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'create_contact',
        arguments: { email: 'pat@example.test' },
      }),
    );
    const text = toolText(result);
    expect(text).toBe(
      'Timed out waiting for OpenSolar during a write (HTTP 504). The change may or may not have been applied. Read the record to check before retrying, so you do not create a duplicate.',
    );
  });

  it('does not include a JSON body for HTTP 403', () => {
    const body = '{"detail":"secret-body"}';
    const text = messageForOpenSolarError(new OpenSolarApiError('x', 403, body));
    expect(text).not.toContain('secret-body');
  });
});
