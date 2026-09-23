import { describe, expect, it } from 'vitest';
import { MAX_PRIVATE_FILE_BYTES, OpenSolarApiError } from '../../src/client/index.js';
import { SystemImageOutputSchema } from '../../src/schemas/system.js';
import { buildServer } from '../../src/server.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

const signedHeader = 'https://files.example.test/private/site.png?Expires=1&Signature=fixture';

describe('get_system_image', () => {
  it('follows the image path and omits the image URL', async () => {
    const calls: Array<{ path: string; readBody?: boolean; timeoutMs?: number }> = [];
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.getFile = async (path, options) => {
      calls.push({ path, readBody: options?.readBody, timeoutMs: options?.timeoutMs });
      return {
        contentType: 'image/png',
        privateFileId: 9,
        bytes: null,
      };
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'get_system_image',
        arguments: {
          project_id: 42,
          system_uuid: 'abc-123',
          width: 500,
          height: 500,
        },
      }),
    );
    const payload = SystemImageOutputSchema.parse(requireStructuredContent(result));

    expect(calls).toEqual([
      {
        path: 'orgs/1/projects/42/systems/abc-123/image/?width=500&height=500',
        readBody: false,
        timeoutMs: 120_000,
      },
    ]);
    expect(payload).toEqual({ id: 9, content_type: 'image/png' });
    expect(payload).not.toHaveProperty('contents');
    expect(JSON.stringify(result)).not.toContain('Signature');
    expect(JSON.stringify(result)).not.toContain(signedHeader);
  });

  it('returns an image block when contents are requested', async () => {
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.getFile = async () => ({
      contentType: 'image/png; charset=binary',
      privateFileId: null,
      bytes: Uint8Array.from([1, 2, 3]),
    });
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'get_system_image',
        arguments: {
          project_id: 42,
          system_uuid: 'abc-123',
          width: 500,
          height: 500,
          include_contents: true,
        },
      }),
    );
    const payload = SystemImageOutputSchema.parse(requireStructuredContent(result));
    const encoded = Buffer.from([1, 2, 3]).toString('base64');

    expect(payload).toEqual({
      id: null,
      content_type: 'image/png; charset=binary',
    });
    expect(result.content).toEqual([
      { type: 'text', text: 'System image for project 42.' },
      { type: 'image', data: encoded, mimeType: 'image/png' },
      { type: 'text', text: JSON.stringify(payload) },
    ]);
  });

  it('refuses a body over 10 MB', async () => {
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.getFile = async () => {
      throw new OpenSolarApiError('System image is over 10 MB', 413, '');
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'get_system_image',
        arguments: {
          project_id: 42,
          system_uuid: 'abc-123',
          width: 500,
          height: 500,
          include_contents: true,
        },
      }),
    );

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: 'System image is over 10 MB' }]);
    expect(MAX_PRIVATE_FILE_BYTES).toBe(10 * 1024 * 1024);
  });

  it('rejects an unknown field before HTTP', async () => {
    const calls: string[] = [];
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.getFile = async (path) => {
      calls.push(path);
      return { contentType: null, privateFileId: null, bytes: null };
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'get_system_image',
        arguments: {
          project_id: 42,
          system_uuid: 'abc-123',
          width: 500,
          height: 500,
          url: signedHeader,
        },
      }),
    );

    expect(result.isError).toBe(true);
    expect(calls).toEqual([]);
  });
});
