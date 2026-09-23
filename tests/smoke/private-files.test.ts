import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MAX_PRIVATE_FILE_BYTES, type OpenSolarClient } from '../../src/client/index.js';
import { MAX_MODEL_TEXT_CHARS } from '../../src/lib/file-contents.js';
import {
  ListPrivateFilesOutputSchema,
  PrivateFileDetailSchema,
} from '../../src/schemas/private-file.js';
import { buildServer } from '../../src/server.js';
import { loadOpenSolarFixture } from '../fixtures/load-fixture.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

const downloadUrl =
  'https://files.example.test/private/site-model.geojson?Expires=1&Signature=fixture';

const uploadPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/opensolar/private-files/upload.txt',
);

function fileClient(download?: OpenSolarClient['download']): {
  client: OpenSolarClient;
  calls: string[];
  downloads: string[];
} {
  const calls: string[] = [];
  const downloads: string[] = [];
  const client = testClient(async (path) => {
    calls.push(path);
    return path.includes('/private_files/?')
      ? loadOpenSolarFixture('private-files', 'list')
      : loadOpenSolarFixture('private-files', 'detail');
  });
  client.download = async (url) => {
    downloads.push(url);
    if (download !== undefined) {
      return download(url);
    }
    throw new Error('unexpected OpenSolar download');
  };
  return { client, calls, downloads };
}

function onePagePdf(text: string): Uint8Array {
  const content = `BT /F1 24 Tf 72 720 Td (${text}) Tj ET`;
  const parts = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const part of parts) {
    offsets.push(body.length);
    body += part;
  }
  const xrefStart = body.length;
  let xref = `xref\n0 ${parts.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${parts.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return new TextEncoder().encode(body + xref + trailer);
}

function assertDownloadUrlAbsent(serialized: string): void {
  expect(serialized).not.toContain('Expires');
  expect(serialized).not.toContain('Signature');
  expect(serialized).not.toContain('files.example.test');
  expect(serialized).not.toContain('HASH-SHOULD-NOT-LEAK');
  expect(serialized).not.toContain('file_contents');
}

describe('list_private_files', () => {
  it('requests one page and omits the download URL', async () => {
    const { client, calls, downloads } = fileClient();
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS, uploadRoot: dirname(uploadPath) });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'list_private_files', arguments: {} }),
    );
    const payload = ListPrivateFilesOutputSchema.parse(requireStructuredContent(result));

    expect(calls).toEqual(['orgs/1/private_files/?page=1&limit=20']);
    expect(downloads).toEqual([]);
    expect(payload.private_files).toEqual([
      {
        id: 501,
        title: 'site-model.geojson',
        file_tags: ['Site Model'],
        project_id: 9001,
      },
    ]);
    assertDownloadUrlAbsent(JSON.stringify(payload));
    assertDownloadUrlAbsent(JSON.stringify(result.content));
  });

  it('sends documented filters only when they are set', async () => {
    const { client, calls } = fileClient();
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS, uploadRoot: dirname(uploadPath) });

    await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'list_private_files',
        arguments: {
          project_id: 9001,
          user_id: 4,
          file_tags: 'Extra File',
          file_tags_exclude: 'Site Model',
          search: 'site',
          ordering: '-modified_date',
        },
      }),
    );

    expect(calls).toEqual([
      'orgs/1/private_files/?page=1&limit=20&project=9001&user_id=4&file_tags=Extra+File&file_tags_exclude=Site+Model&search=site&ordering=-modified_date',
    ]);
  });

  it('rejects an unknown filter before HTTP', async () => {
    const { client, calls } = fileClient();
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS, uploadRoot: dirname(uploadPath) });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'list_private_files',
        arguments: { filename: 'site-model.geojson' },
      }),
    );

    expect(result.isError).toBe(true);
    expect(calls).toEqual([]);
  });
});

describe('get_private_file', () => {
  it('returns size and omits the download URL', async () => {
    const { client, calls, downloads } = fileClient();
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS, uploadRoot: dirname(uploadPath) });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'get_private_file', arguments: { id: 501 } }),
    );
    const payload = PrivateFileDetailSchema.parse(requireStructuredContent(result));

    expect(calls).toEqual(['orgs/1/private_files/501/']);
    expect(downloads).toEqual([]);
    expect(payload).toEqual({
      id: 501,
      title: 'site-model.geojson',
      file_tags: ['Site Model'],
      project_id: 9001,
      size: 32,
      content_type: null,
    });
    assertDownloadUrlAbsent(JSON.stringify(payload));
  });

  it('returns text contents without the download URL', async () => {
    const { client, downloads } = fileClient(async () => ({
      bytes: new TextEncoder().encode('{"ok":true}'),
      contentType: 'application/geo+json',
    }));
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS, uploadRoot: dirname(uploadPath) });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'get_private_file',
        arguments: { id: 501, include_contents: true },
      }),
    );
    const payload = PrivateFileDetailSchema.parse(requireStructuredContent(result));
    const serialized = JSON.stringify({ payload, text: result.content });

    expect(downloads).toEqual([downloadUrl]);
    expect(payload.contents).toEqual({ encoding: 'text', body: '{"ok":true}' });
    expect(payload.content_type).toBe('application/geo+json');
    expect(result.content).toEqual([
      { type: 'text', text: 'Private file 501: site-model.geojson.' },
      { type: 'text', text: '{"ok":true}' },
    ]);
    assertDownloadUrlAbsent(serialized);
  });

  it('caps model text and marks the structured body truncated', async () => {
    const body = 'a'.repeat(MAX_MODEL_TEXT_CHARS + 1);
    const { client } = fileClient(async () => ({
      bytes: new TextEncoder().encode(body),
      contentType: 'text/plain',
    }));
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS, uploadRoot: dirname(uploadPath) });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'get_private_file',
        arguments: { id: 501, include_contents: true },
      }),
    );
    const payload = PrivateFileDetailSchema.parse(requireStructuredContent(result));

    expect(payload.contents).toEqual({
      encoding: 'text',
      body: 'a'.repeat(MAX_MODEL_TEXT_CHARS),
      truncated: true,
    });
    expect(result.content).toEqual([
      { type: 'text', text: 'Private file 501: site-model.geojson.' },
      {
        type: 'text',
        text: `${'a'.repeat(MAX_MODEL_TEXT_CHARS)}\n[Truncated. 1 character omitted.]`,
      },
    ]);
  });

  it('returns image contents as an MCP image block without duplicating base64 in structured content', async () => {
    const { client } = fileClient(async () => ({
      bytes: Uint8Array.from([1, 2, 3]),
      contentType: 'image/png; charset=binary',
    }));
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS, uploadRoot: dirname(uploadPath) });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'get_private_file',
        arguments: { id: 501, include_contents: true },
      }),
    );
    const payload = PrivateFileDetailSchema.parse(requireStructuredContent(result));

    const encoded = Buffer.from([1, 2, 3]).toString('base64');
    expect(payload.contents).toBeUndefined();
    expect(payload.content_type).toBe('image/png; charset=binary');
    expect(result.content).toEqual([
      { type: 'text', text: 'Private file 501: site-model.geojson.' },
      { type: 'image', data: encoded, mimeType: 'image/png' },
    ]);
  });

  it('returns extracted PDF text and a resource that is not the download URL', async () => {
    const bytes = onePagePdf('Hello solar');
    const { client } = fileClient(async () => ({
      bytes,
      contentType: 'application/pdf',
    }));
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS, uploadRoot: dirname(uploadPath) });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'get_private_file',
        arguments: { id: 501, include_contents: true },
      }),
    );
    const payload = PrivateFileDetailSchema.parse(requireStructuredContent(result));
    const serialized = JSON.stringify({ payload, text: result.content });

    const encoded = Buffer.from(bytes).toString('base64');
    expect(payload.contents).toBeUndefined();
    expect(result.content).toEqual([
      { type: 'text', text: 'Private file 501: site-model.geojson. 1 page.' },
      { type: 'text', text: 'Hello solar' },
      {
        type: 'resource',
        resource: {
          uri: 'opensolar://private-files/501',
          mimeType: 'application/pdf',
          blob: encoded,
        },
      },
    ]);
    assertDownloadUrlAbsent(serialized);
  });

  it('keeps a PDF resource when text cannot be extracted', async () => {
    const { client } = fileClient(async () => ({
      bytes: Uint8Array.from([1, 2, 3]),
      contentType: 'application/pdf',
    }));
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS, uploadRoot: dirname(uploadPath) });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'get_private_file',
        arguments: { id: 501, include_contents: true },
      }),
    );

    expect(result.content).toEqual([
      { type: 'text', text: 'Private file 501: site-model.geojson.' },
      { type: 'text', text: 'PDF text could not be extracted.' },
      {
        type: 'resource',
        resource: {
          uri: 'opensolar://private-files/501',
          mimeType: 'application/pdf',
          blob: Buffer.from([1, 2, 3]).toString('base64'),
        },
      },
    ]);
  });

  it('returns other binary files as embedded resources without structured base64', async () => {
    const { client } = fileClient(async () => ({
      bytes: Uint8Array.from([1, 2, 3]),
      contentType: 'application/octet-stream',
    }));
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS, uploadRoot: dirname(uploadPath) });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'get_private_file',
        arguments: { id: 501, include_contents: true },
      }),
    );
    const payload = PrivateFileDetailSchema.parse(requireStructuredContent(result));

    const encoded = Buffer.from([1, 2, 3]).toString('base64');
    expect(payload.contents).toBeUndefined();
    expect(result.content).toEqual([
      { type: 'text', text: 'Private file 501: site-model.geojson.' },
      {
        type: 'resource',
        resource: {
          uri: 'opensolar://private-files/501',
          mimeType: 'application/octet-stream',
          blob: encoded,
        },
      },
    ]);
  });

  it('refuses a body over 10 MB', async () => {
    const { client } = fileClient(async () => ({
      bytes: new Uint8Array(MAX_PRIVATE_FILE_BYTES + 1),
      contentType: 'application/octet-stream',
    }));
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS, uploadRoot: dirname(uploadPath) });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'get_private_file',
        arguments: { id: 501, include_contents: true },
      }),
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(result.content).toEqual([{ type: 'text', text: 'Private file is over 10 MB' }]);
  });
});

describe('create_private_file', () => {

  it('is disabled until OPENSOLAR_UPLOAD_ROOT is configured', async () => {
    const { client, calls } = fileClient();
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'create_private_file',
        arguments: { path: uploadPath, title: 'My Document' },
      }),
    );

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'Local file uploads are disabled. Set OPENSOLAR_UPLOAD_ROOT to a directory before using create_private_file.',
      },
    ]);
    expect(calls).toEqual([]);
  });

  it('rejects a resolved path outside OPENSOLAR_UPLOAD_ROOT, including through a symlink', async () => {
    const root = await mkdtemp(join(tmpdir(), 'opensolar-upload-root-'));
    const outside = await mkdtemp(join(tmpdir(), 'opensolar-upload-outside-'));
    try {
      const secret = join(outside, 'secret.txt');
      const link = join(root, 'linked-secret.txt');
      await writeFile(secret, 'do not upload');
      await symlink(secret, link);

      const { client, calls } = fileClient();
      const mcp = buildServer({
        client,
        orgId: 1,
        filters: ALL_TOOL_FILTERS,
        uploadRoot: root,
      });

      const result = await withMcpClient(mcp, (session) =>
        session.callTool({
          name: 'create_private_file',
          arguments: { path: 'linked-secret.txt', title: 'Nope' },
        }),
      );

      expect(result.isError).toBe(true);
      expect(result.content).toEqual([
        { type: 'text', text: 'Private file path is outside OPENSOLAR_UPLOAD_ROOT.' },
      ]);
      expect(calls).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('streams the file as multipart title and file_contents', async () => {
    const forms: FormData[] = [];
    const { client, calls } = fileClient();
    client.postForm = async (path, form) => {
      calls.push(path);
      forms.push(form);
      return loadOpenSolarFixture('private-files', 'detail');
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS, uploadRoot: dirname(uploadPath) });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'create_private_file',
        arguments: { path: uploadPath, title: 'My Document' },
      }),
    );
    const payload = PrivateFileDetailSchema.parse(requireStructuredContent(result));
    const form = forms[0];
    const uploaded = form?.get('file_contents');

    expect(calls).toEqual(['orgs/1/private_files/']);
    expect(form).toBeDefined();
    expect([...(form?.keys() ?? [])]).toEqual(['title', 'file_contents']);
    expect(form?.get('title')).toBe('My Document');
    expect(uploaded).toBeInstanceOf(File);
    if (uploaded instanceof File) {
      expect(uploaded.name).toBe('upload.txt');
      expect(Buffer.from(await uploaded.arrayBuffer())).toEqual(await readFile(uploadPath));
    }
    expect(payload).toEqual({
      id: 501,
      title: 'site-model.geojson',
      file_tags: ['Site Model'],
      project_id: 9001,
      size: 32,
      content_type: null,
    });
    assertDownloadUrlAbsent(JSON.stringify({ payload, text: result.content }));
  });

  it('rejects an unknown field before HTTP', async () => {
    const { client, calls } = fileClient();
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS, uploadRoot: dirname(uploadPath) });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'create_private_file',
        arguments: { path: uploadPath, title: 'My Document', project_id: 9001 },
      }),
    );

    expect(result.isError).toBe(true);
    expect(calls).toEqual([]);
  });

  it('does not call OpenSolar when the path is missing', async () => {
    const { client, calls } = fileClient();
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS, uploadRoot: dirname(uploadPath) });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'create_private_file',
        arguments: {
          path: join(dirname(uploadPath), 'missing-upload.txt'),
          title: 'My Document',
        },
      }),
    );

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: 'Private file path was not found.' }]);
    expect(calls).toEqual([]);
  });

  it('does not call OpenSolar when the path is a directory', async () => {
    const { client, calls } = fileClient();
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS, uploadRoot: dirname(uploadPath) });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'create_private_file',
        arguments: { path: dirname(uploadPath), title: 'My Document' },
      }),
    );

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: 'Private file path is not a file.' }]);
    expect(calls).toEqual([]);
  });
});

describe('update_private_file', () => {
  it('patches only title and omits the download URL', async () => {
    const patches: unknown[] = [];
    const { client, calls } = fileClient();
    client.patch = async (path, body) => {
      calls.push(path);
      patches.push(body);
      return loadOpenSolarFixture('private-files', 'detail');
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS, uploadRoot: dirname(uploadPath) });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'update_private_file',
        arguments: { id: 501, title: 'new title' },
      }),
    );
    const payload = PrivateFileDetailSchema.parse(requireStructuredContent(result));

    expect(calls).toEqual(['orgs/1/private_files/501/']);
    expect(patches).toEqual([{ title: 'new title' }]);
    expect(payload.id).toBe(501);
    assertDownloadUrlAbsent(JSON.stringify({ payload, text: result.content }));
  });

  it('rejects an unknown field before HTTP', async () => {
    const { client, calls } = fileClient();
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS, uploadRoot: dirname(uploadPath) });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'update_private_file',
        arguments: { id: 501, title: 'new title', show_customer: true },
      }),
    );

    expect(result.isError).toBe(true);
    expect(calls).toEqual([]);
  });
});

describe('delete_private_file', () => {
  it('returns id and deleted without the upstream body', async () => {
    const { client, calls } = fileClient();
    client.delete = async (path) => {
      calls.push(path);
      return { file_contents: downloadUrl, secret: 'HASH-SHOULD-NOT-LEAK' };
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS, uploadRoot: dirname(uploadPath) });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'delete_private_file', arguments: { id: 501 } }),
    );

    expect(calls).toEqual(['orgs/1/private_files/501/']);
    expect(requireStructuredContent(result)).toEqual({ id: 501, deleted: true });
    assertDownloadUrlAbsent(JSON.stringify(result));
  });
});
