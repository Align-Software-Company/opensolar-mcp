import { openAsBlob } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { openSolarSuccess, runOpenSolarTool } from '../client/errors.js';
import {
  MAX_PRIVATE_FILE_BYTES,
  NON_JSON_BODY_MESSAGE,
  OpenSolarApiError,
  type OpenSolarClient,
} from '../client/index.js';
import { DOCUMENT_TYPES } from '../lib/enums/document-types.js';
import { FILE_TAGS } from '../lib/enums/file-tags.js';
import {
  type FileModelBlock,
  fileModelBlocks,
  isTextMedia,
  mediaType,
} from '../lib/file-contents.js';
import { privateFileIdFromText } from '../lib/private-file-id.js';
import type { ToolName } from '../lib/tier-policy.js';
import {
  curatePrivateFile,
  GeneratedDocumentOutputSchema,
  ListPrivateFilesOutputSchema,
  type PrivateFileDetail,
  PrivateFileDetailSchema,
  PrivateFileListSchema,
  PrivateFileSchema,
} from '../schemas/private-file.js';
import { DeletedRecordSchema } from '../schemas/project.js';

export interface FilesContext {
  client: OpenSolarClient;
  orgId: number;
}

const readAnnotations = { readOnlyHint: true, openWorldHint: true } as const;

const createAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;

const updateAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

const deleteAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
} as const;

const FILE_ORDERING = [
  'created_date',
  'modified_date',
  'title',
  'status',
  'filesize',
  '-created_date',
  '-modified_date',
  '-title',
  '-status',
  '-filesize',
] as const;

const listPrivateFilesInput = z
  .object({
    page: z.number().int().min(1).default(1).describe('1-indexed page number. Defaults to 1.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe('Maximum files per page. Defaults to 20, capped at 100.'),
    project_id: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('When set, keep files for this project. Sent as the project query parameter.'),
    user_id: z.number().int().positive().optional().describe('When set, keep files for this user.'),
    file_tags: z
      .enum(FILE_TAGS)
      .optional()
      .describe('When set, keep files with this file-tag title.'),
    file_tags_exclude: z
      .enum(FILE_TAGS)
      .optional()
      .describe('When set, omit files with this file-tag title.'),
    search: z
      .string()
      .optional()
      .describe(
        'When set, search title, system_uuid, input_data, input_data_hash, file_hash, status, and status_message.',
      ),
    ordering: z
      .enum(FILE_ORDERING)
      .optional()
      .describe(
        'created_date, modified_date, title, status, or filesize. Prefix with - for descending. Default upstream order is -modified_date.',
      ),
  })
  .strict();

const privateFileIdInput = z
  .object({
    id: z
      .number()
      .int()
      .positive()
      .describe('Private file id. Use list_private_files to discover ids.'),
    include_contents: z
      .boolean()
      .default(false)
      .describe(
        'When true, the server downloads the file and refuses a body over 10 MB. Text is capped at 100,000 characters in the model result. Images are image content. PDFs include extracted text and a PDF resource. The download URL is not returned.',
      ),
  })
  .strict();

const oversizeResult = {
  isError: true as const,
  content: [{ type: 'text' as const, text: 'Private file is over 10 MB' }],
};

const createPrivateFileInput = z
  .object({
    path: z
      .string()
      .min(1)
      .describe(
        'Filesystem path on the machine running this server. The server streams that file. File bytes are not accepted here.',
      ),
    title: z.string().min(1).describe('File title. Sent as the multipart title field.'),
  })
  .strict();

const updatePrivateFileInput = z
  .object({
    id: z
      .number()
      .int()
      .positive()
      .describe('Private file id. Use list_private_files to discover ids.'),
    title: z.string().min(1).describe('New title. The published sample sends only title.'),
  })
  .strict();

const deletePrivateFileInput = z
  .object({
    id: z
      .number()
      .int()
      .positive()
      .describe('Private file id. Use list_private_files to discover ids.'),
  })
  .strict();

function isEnoent(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function pathError(text: string): {
  isError: true;
  content: [{ type: 'text'; text: string }];
} {
  return { isError: true, content: [{ type: 'text', text }] };
}

function curatedDetail(raw: unknown): PrivateFileDetail {
  const file = PrivateFileSchema.parse(raw);
  return PrivateFileDetailSchema.parse({
    ...curatePrivateFile(file),
    size: file.filesize ?? null,
    content_type: file.content_type ?? null,
  });
}

async function privateFileForm(
  filePath: string,
  title: string,
): Promise<FormData | { isError: true; content: [{ type: 'text'; text: string }] }> {
  let info: Awaited<ReturnType<typeof stat>>;
  try {
    info = await stat(filePath);
  } catch (error) {
    if (isEnoent(error)) {
      return pathError('Private file path was not found.');
    }
    throw error;
  }
  if (!info.isFile()) {
    return pathError('Private file path is not a file.');
  }
  const form = new FormData();
  form.append('title', title);
  form.append('file_contents', await openAsBlob(filePath), basename(filePath));
  return form;
}

function pageLabel(pageCount: number): string {
  return pageCount === 1 ? '1 page' : `${pageCount} pages`;
}

function fileSummary(id: number, title: string, pageCount: number | null): string {
  const name = title === '' ? `Private file ${id}.` : `Private file ${id}: ${title}.`;
  if (pageCount === null) {
    return name;
  }
  return `${name} ${pageLabel(pageCount)}.`;
}

export function registerFilesToolset(
  server: McpServer,
  ctx: FilesContext,
  enabled: ReadonlySet<ToolName>,
): void {
  if (enabled.has('list_private_files')) {
    registerListPrivateFiles(server, ctx);
  }
  if (enabled.has('get_private_file')) {
    registerGetPrivateFile(server, ctx);
  }
  if (enabled.has('create_private_file')) {
    registerCreatePrivateFile(server, ctx);
  }
  if (enabled.has('update_private_file')) {
    registerUpdatePrivateFile(server, ctx);
  }
  if (enabled.has('delete_private_file')) {
    registerDeletePrivateFile(server, ctx);
  }
  if (enabled.has('generate_project_document')) {
    registerGenerateProjectDocument(server, ctx);
  }
}

function registerListPrivateFiles(server: McpServer, ctx: FilesContext): void {
  server.registerTool(
    'list_private_files',
    {
      title: 'List private files',
      description:
        'Lists one page of private files as `{ private_files, page, limit }`. ' +
        'Each row is id, title, file tag titles, and project id. The download URL is omitted.',
      inputSchema: listPrivateFilesInput,
      outputSchema: ListPrivateFilesOutputSchema,
      annotations: readAnnotations,
    },
    async ({ page, limit, project_id, user_id, file_tags, file_tags_exclude, search, ordering }) =>
      runOpenSolarTool(async () => {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        if (project_id !== undefined) {
          params.set('project', String(project_id));
        }
        if (user_id !== undefined) {
          params.set('user_id', String(user_id));
        }
        if (file_tags !== undefined) {
          params.set('file_tags', file_tags);
        }
        if (file_tags_exclude !== undefined) {
          params.set('file_tags_exclude', file_tags_exclude);
        }
        if (search !== undefined) {
          params.set('search', search);
        }
        if (ordering !== undefined) {
          params.set('ordering', ordering);
        }
        const path = `orgs/${ctx.orgId}/private_files/?${params.toString()}`;
        const raw = await ctx.client.get(path);
        const privateFiles = PrivateFileListSchema.parse(raw).map(curatePrivateFile);
        const payload = ListPrivateFilesOutputSchema.parse({
          private_files: privateFiles,
          page,
          limit,
        });
        return openSolarSuccess(
          payload,
          `${payload.private_files.length} private files on page ${payload.page} (limit ${payload.limit}).`,
        );
      }),
  );
}

function registerGetPrivateFile(server: McpServer, ctx: FilesContext): void {
  server.registerTool(
    'get_private_file',
    {
      title: 'Get private file',
      description:
        'Returns one private file by id: title, file tag titles, project id, and size when OpenSolar sent it. ' +
        'The download URL stays on the server. `include_contents: true` downloads the file and refuses a body over 10 MB. ' +
        'Text is included for the model, capped at 100,000 characters. Images are image content. ' +
        'PDFs include extracted text and a PDF resource. That resource URI is not the download URL.',
      inputSchema: privateFileIdInput,
      outputSchema: PrivateFileDetailSchema,
      annotations: readAnnotations,
    },
    async ({ id, include_contents }) =>
      runOpenSolarTool(async () => {
        const raw = await ctx.client.get(`orgs/${ctx.orgId}/private_files/${id}/`);
        const file = PrivateFileSchema.parse(raw);
        const row = curatePrivateFile(file);
        let contentType = file.content_type ?? null;
        let contents: { encoding: 'text' | 'base64'; body: string; truncated?: true } | undefined;
        let modelBlocks: FileModelBlock[] = [];
        let pageCount: number | null = null;

        if (include_contents) {
          const downloadUrl = file.file_contents;
          if (downloadUrl === null || downloadUrl === undefined || downloadUrl === '') {
            return {
              isError: true as const,
              content: [{ type: 'text' as const, text: `Private file ${id} has no download.` }],
            };
          }
          let downloaded: { bytes: Uint8Array; contentType: string | null };
          try {
            downloaded = await ctx.client.download(downloadUrl);
          } catch (error) {
            if (error instanceof OpenSolarApiError && error.status === 413) {
              return oversizeResult;
            }
            throw error;
          }
          if (downloaded.bytes.byteLength > MAX_PRIVATE_FILE_BYTES) {
            return oversizeResult;
          }
          if (contentType === null && downloaded.contentType !== null) {
            contentType = downloaded.contentType;
          }
          const model = await fileModelBlocks({
            id,
            bytes: downloaded.bytes,
            contentType,
          });
          modelBlocks = model.blocks;
          pageCount = model.pageCount;
          const text = isTextMedia(mediaType(contentType));
          contents = text
            ? {
                encoding: 'text',
                body: model.textBody ?? '',
                ...(model.omitted > 0 ? { truncated: true as const } : {}),
              }
            : {
                encoding: 'base64',
                body: Buffer.from(downloaded.bytes).toString('base64'),
              };
        }

        const payload = PrivateFileDetailSchema.parse({
          ...row,
          size: file.filesize,
          content_type: contentType,
          ...(contents !== undefined ? { contents } : {}),
        });
        const title = payload.title ?? '';
        const summary = fileSummary(id, title, pageCount);
        if (modelBlocks.length === 0) {
          return openSolarSuccess(payload, summary);
        }
        return {
          content: [{ type: 'text' as const, text: summary }, ...modelBlocks],
          structuredContent: payload,
        };
      }),
  );
}

function registerCreatePrivateFile(server: McpServer, ctx: FilesContext): void {
  server.registerTool(
    'create_private_file',
    {
      title: 'Create private file',
      description:
        'Creates a private file in the live org from a filesystem path on this server. ' +
        'The server streams that file as multipart title and file_contents. File bytes are not accepted from the model. ' +
        'The download URL is omitted. This call is not retried.',
      inputSchema: createPrivateFileInput,
      outputSchema: PrivateFileDetailSchema,
      annotations: createAnnotations,
    },
    async ({ path, title }) =>
      runOpenSolarTool(async () => {
        const form = await privateFileForm(path, title);
        if ('isError' in form) {
          return form;
        }
        const raw = await ctx.client.postForm(`orgs/${ctx.orgId}/private_files/`, form);
        const payload = curatedDetail(raw);
        const createdTitle = payload.title ?? title;
        const summary =
          createdTitle === ''
            ? `Private file ${payload.id}.`
            : `Private file ${payload.id}: ${createdTitle}.`;
        return openSolarSuccess(payload, summary);
      }),
  );
}

function registerUpdatePrivateFile(server: McpServer, ctx: FilesContext): void {
  server.registerTool(
    'update_private_file',
    {
      title: 'Update private file',
      description:
        'Updates a private file title in the live org. The published sample sends only title. ' +
        'The download URL is omitted. This call is not retried.',
      inputSchema: updatePrivateFileInput,
      outputSchema: PrivateFileDetailSchema,
      annotations: updateAnnotations,
    },
    async ({ id, title }) =>
      runOpenSolarTool(async () => {
        const raw = await ctx.client.patch(`orgs/${ctx.orgId}/private_files/${id}/`, { title });
        const payload = curatedDetail(raw);
        const updatedTitle = payload.title ?? title;
        const summary =
          updatedTitle === ''
            ? `Private file ${payload.id}.`
            : `Private file ${payload.id}: ${updatedTitle}.`;
        return openSolarSuccess(payload, summary);
      }),
  );
}

function registerDeletePrivateFile(server: McpServer, ctx: FilesContext): void {
  server.registerTool(
    'delete_private_file',
    {
      title: 'Delete private file',
      description: 'Removes the private file from the live org. This call is not retried.',
      inputSchema: deletePrivateFileInput,
      outputSchema: DeletedRecordSchema,
      annotations: deleteAnnotations,
    },
    async ({ id }) =>
      runOpenSolarTool(async () => {
        await ctx.client.delete(`orgs/${ctx.orgId}/private_files/${id}/`);
        const payload = DeletedRecordSchema.parse({ id, deleted: true });
        return openSolarSuccess(payload, `Delete private file ${id}.`);
      }),
  );
}

const generateProjectDocumentInput = z
  .object({
    project_id: z
      .number()
      .int()
      .positive()
      .describe('Project id. Use list_projects to discover ids.'),
    document_type: z
      .enum(DOCUMENT_TYPES)
      .describe('Document type from the Generating Project Files page.'),
    format: z
      .enum(['html', 'pdf', 'docx'])
      .describe(
        'html calls generate_document. pdf calls generate_document_pdf. docx calls generate_document_docx.',
      ),
  })
  .strict();

const missingDocumentId = {
  isError: true as const,
  content: [
    { type: 'text' as const, text: 'Generated document did not include a private file id.' },
  ],
};

function privateFileIdFromGenerated(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw > 0 ? raw : null;
  }
  if (typeof raw === 'string') {
    return privateFileIdFromText(raw);
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = z.record(z.string(), z.unknown()).safeParse(raw);
  if (!record.success) {
    return null;
  }
  const id = record.data.id;
  if (typeof id === 'number' && Number.isInteger(id) && id > 0) {
    return id;
  }
  for (const value of Object.values(record.data)) {
    if (typeof value !== 'string') {
      continue;
    }
    const fromText = privateFileIdFromText(value);
    if (fromText !== null) {
      return fromText;
    }
  }
  return null;
}

function generateDocumentPath(
  orgId: number,
  projectId: number,
  documentType: string,
  format: 'html' | 'pdf' | 'docx',
): string {
  const endpoint =
    format === 'pdf'
      ? 'generate_document_pdf'
      : format === 'docx'
        ? 'generate_document_docx'
        : 'generate_document';
  const params = new URLSearchParams({ action: 'save' });
  return `orgs/${orgId}/projects/${projectId}/${endpoint}/${encodeURIComponent(documentType)}/?${params.toString()}`;
}

function registerGenerateProjectDocument(server: McpServer, ctx: FilesContext): void {
  server.registerTool(
    'generate_project_document',
    {
      title: 'Generate project document',
      description:
        'Creates a project document in the live org and returns the private file id. ' +
        'format html calls generate_document, pdf calls generate_document_pdf, and docx calls generate_document_docx. ' +
        'The call sends action=save so OpenSolar stores a private file. File bytes are not returned. ' +
        'Use get_private_file for contents. This call is not retried.',
      inputSchema: generateProjectDocumentInput,
      outputSchema: GeneratedDocumentOutputSchema,
      annotations: createAnnotations,
    },
    async ({ project_id, document_type, format }) =>
      runOpenSolarTool(async () => {
        const path = generateDocumentPath(ctx.orgId, project_id, document_type, format);
        let raw: unknown;
        try {
          raw = await ctx.client.post(path, undefined);
        } catch (error) {
          if (error instanceof OpenSolarApiError && error.message === NON_JSON_BODY_MESSAGE) {
            return missingDocumentId;
          }
          throw error;
        }
        const id = privateFileIdFromGenerated(raw);
        if (id === null) {
          return missingDocumentId;
        }
        const payload = GeneratedDocumentOutputSchema.parse({ id });
        return openSolarSuccess(payload, `Private file ${payload.id}.`);
      }),
  );
}
