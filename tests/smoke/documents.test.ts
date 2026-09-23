import { describe, expect, it } from 'vitest';
import { NON_JSON_BODY_MESSAGE, OpenSolarApiError } from '../../src/client/index.js';
import { GeneratedDocumentOutputSchema } from '../../src/schemas/private-file.js';
import { buildServer } from '../../src/server.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

const signedReference =
  'https://api.opensolar.com/api/orgs/1/private_files/44/?Expires=1&Signature=fixture';

describe('generate_project_document', () => {
  it('posts action=save on the path for each format and returns only the id', async () => {
    const posts: Array<{ path: string; body: unknown }> = [];
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.post = async (path, body) => {
      posts.push({ path, body });
      return { id: 44, file_contents: signedReference };
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const html = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'generate_project_document',
        arguments: { project_id: 9, document_type: 'proposal', format: 'html' },
      }),
    );
    const pdf = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'generate_project_document',
        arguments: { project_id: 9, document_type: 'contract', format: 'pdf' },
      }),
    );
    const docx = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'generate_project_document',
        arguments: { project_id: 9, document_type: 'contract', format: 'docx' },
      }),
    );

    expect(posts).toEqual([
      {
        path: 'orgs/1/projects/9/generate_document/proposal/?action=save',
        body: undefined,
      },
      {
        path: 'orgs/1/projects/9/generate_document_pdf/contract/?action=save',
        body: undefined,
      },
      {
        path: 'orgs/1/projects/9/generate_document_docx/contract/?action=save',
        body: undefined,
      },
    ]);
    for (const result of [html, pdf, docx]) {
      expect(GeneratedDocumentOutputSchema.parse(requireStructuredContent(result))).toEqual({
        id: 44,
      });
      expect(JSON.stringify(result)).not.toContain('Signature');
      expect(JSON.stringify(result)).not.toContain('file_contents');
    }
  });

  it('reads a private file id from a URL reference', async () => {
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.post = async () => signedReference;
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'generate_project_document',
        arguments: { project_id: 9, document_type: 'shade_report', format: 'html' },
      }),
    );

    expect(requireStructuredContent(result)).toEqual({ id: 44 });
    expect(JSON.stringify(result)).not.toContain('Expires');
  });

  it('refuses a response that has no private file id', async () => {
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.post = async () => ({ status: 'created' });
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'generate_project_document',
        arguments: { project_id: 9, document_type: 'proposal', format: 'pdf' },
      }),
    );

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: 'Generated document did not include a private file id.' },
    ]);
  });

  it('does not return a non-JSON body', async () => {
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.post = async () => {
      throw new OpenSolarApiError(NON_JSON_BODY_MESSAGE, 200, '');
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'generate_project_document',
        arguments: { project_id: 9, document_type: 'proposal', format: 'pdf' },
      }),
    );

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain('Signature');
    expect(result.content).toEqual([
      { type: 'text', text: 'Generated document did not include a private file id.' },
    ]);
  });

  it('rejects an unknown field before HTTP', async () => {
    const posts: string[] = [];
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.post = async (path) => {
      posts.push(path);
      return { id: 1 };
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'generate_project_document',
        arguments: {
          project_id: 9,
          document_type: 'proposal',
          format: 'html',
          system_uuid: 'abc',
        },
      }),
    );

    expect(result.isError).toBe(true);
    expect(posts).toEqual([]);
  });
});
