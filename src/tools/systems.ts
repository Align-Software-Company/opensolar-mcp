import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { openSolarSuccess, runOpenSolarTool, structuredContentText } from '../client/errors.js';
import {
  MAX_PRIVATE_FILE_BYTES,
  OpenSolarApiError,
  type OpenSolarClient,
} from '../client/index.js';
import { loadSystemComparison } from '../lib/compare-project-systems.js';
import { fileModelBlocks } from '../lib/file-contents.js';
import type { ToolName } from '../lib/tier-policy.js';
import {
  curateSystem,
  curateSystemDetails,
  curateSystemListRow,
  GetSystemDetailsOutputSchema,
  GetSystemOutputSchema,
  ListProjectSystemsOutputSchema,
  SystemDetailsResponseSchema,
  SystemImageOutputSchema,
  SystemListSchema,
  SystemSchema,
} from '../schemas/system.js';
import { CompareProjectSystemsSchema } from '../schemas/system-comparison.js';

export interface SystemsContext {
  client: OpenSolarClient;
  orgId: number;
}

const readAnnotations = { readOnlyHint: true, openWorldHint: true } as const;

const imageAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

// The first call generates a private file and can be slow.
const SYSTEM_IMAGE_TIMEOUT_MS = 120_000;

const oversizeImage = {
  isError: true as const,
  content: [{ type: 'text' as const, text: 'System image is over 10 MB' }],
};

const getSystemImageInput = z
  .object({
    project_id: z
      .number()
      .int()
      .positive()
      .describe('Project id. Use list_projects to discover ids.'),
    system_uuid: z
      .string()
      .min(1)
      .describe('System uuid. Use list_project_systems or get_system to discover it.'),
    width: z.number().int().positive().describe('Image width in pixels. Required by OpenSolar.'),
    height: z.number().int().positive().describe('Image height in pixels. Required by OpenSolar.'),
    include_contents: z
      .boolean()
      .default(false)
      .describe(
        'When true, the server returns the image and refuses a body over 10 MB. The image URL is not returned.',
      ),
  })
  .strict();

// Large projects time out on this endpoint. See docs/api-quirks.md.
const SYSTEM_DETAILS_TIMEOUT_MS = 120_000;
// OpenSolar applies part filters only to each system's `data` field, which
// this tool does not return. The default keeps that field small.
const DEFAULT_INCLUDE_PARTS = 'modules,inverters,batteries,module_groups,incentives';

const pageLimitFields = {
  page: z.number().int().min(1).default(1).describe('1-indexed page number. Defaults to 1.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Maximum systems per page. Defaults to 20, capped at 100.'),
};

const listProjectSystemsInputSchema = z.object({
  project_id: z
    .number()
    .int()
    .positive()
    .describe('Project whose systems to list. Use list_projects to discover ids.'),
  ...pageLimitFields,
});

const getSystemInputSchema = z.object({
  id: z
    .number()
    .int()
    .positive()
    .describe('OpenSolar system id. Use list_project_systems to discover ids.'),
});

const getSystemDetailsInputSchema = z
  .object({
    project_id: z
      .number()
      .int()
      .positive()
      .describe('Project the connected org owns. Shared team projects cannot use this endpoint.'),
    include_parts: z
      .string()
      .optional()
      .describe(
        "Comma-separated fields to keep inside each system's upstream `data` field. " +
          'OpenSolar applies it only to `data`, which this tool does not return, so it does not change the result. ' +
          'Defaults to modules,inverters,batteries,module_groups,incentives. Do not set this together with exclude_parts.',
      ),
    exclude_parts: z
      .string()
      .optional()
      .describe(
        "Comma-separated fields to drop from each system's upstream `data` field instead of include_parts. " +
          'It does not change the result. Do not set this together with include_parts.',
      ),
  })
  .refine(
    (value) => {
      const include = value.include_parts?.trim() ?? '';
      const exclude = value.exclude_parts?.trim() ?? '';
      return include === '' || exclude === '';
    },
    { message: 'include_parts and exclude_parts cannot both be set' },
  );

function systemDetailsQuery(
  includeParts: string | undefined,
  excludeParts: string | undefined,
): string {
  const include = includeParts?.trim() ?? '';
  const exclude = excludeParts?.trim() ?? '';
  if (exclude !== '') {
    return new URLSearchParams({ exclude_parts: exclude }).toString();
  }
  return new URLSearchParams({
    include_parts: include !== '' ? include : DEFAULT_INCLUDE_PARTS,
  }).toString();
}

export function registerSystemsToolset(
  server: McpServer,
  ctx: SystemsContext,
  enabled: ReadonlySet<ToolName>,
): void {
  if (enabled.has('list_project_systems')) {
    server.registerTool(
      'list_project_systems',
      {
        title: 'List project systems',
        description:
          'Lists one page of systems for a project as `{ systems, page, limit }`. ' +
          'Each row has id, name, size, module count, battery kWh, annual output, and price. ' +
          'Not the full pricing breakdown.',
        inputSchema: listProjectSystemsInputSchema,
        outputSchema: ListProjectSystemsOutputSchema,
        annotations: readAnnotations,
      },
      async ({ project_id, page, limit }) =>
        runOpenSolarTool(async () => {
          const params = new URLSearchParams({
            fieldset: 'list',
            project: String(project_id),
            page: String(page),
            limit: String(limit),
          });
          const path = `orgs/${ctx.orgId}/systems/?${params.toString()}`;
          const raw = await ctx.client.get(path);
          const systems = SystemListSchema.parse(raw).map(curateSystemListRow);
          const payload = ListProjectSystemsOutputSchema.parse({ systems, page, limit });
          return openSolarSuccess(
            payload,
            `${payload.systems.length} systems on page ${payload.page} (limit ${payload.limit}).`,
          );
        }),
    );
  }

  if (enabled.has('compare_project_systems')) {
    server.registerTool(
      'compare_project_systems',
      {
        title: 'Compare project systems',
        description:
          'Compares the systems on one project. Columns are included only when that system payload has them: kW, module count, annual kWh, kWh per kW, price, price per watt, battery kWh, and hardware names. ' +
          'No system is ranked. One system-details call runs when a listed system is missing modules, inverters, or batteries. ' +
          'An empty array counts as present. Groups already on the list are not replaced. ' +
          'A failed details call leaves hardware_gap and still returns the list columns.',
        inputSchema: z
          .object({
            project_id: z
              .number()
              .int()
              .positive()
              .describe('Project id from list_projects or search_projects.'),
          })
          .strict(),
        outputSchema: CompareProjectSystemsSchema,
        annotations: readAnnotations,
      },
      async ({ project_id }) =>
        runOpenSolarTool(async () => {
          const payload = CompareProjectSystemsSchema.parse(
            await loadSystemComparison(ctx.client, ctx.orgId, project_id),
          );
          return openSolarSuccess(
            payload,
            `${payload.systems.length} systems on project ${project_id}.`,
          );
        }),
    );
  }

  if (enabled.has('get_system')) {
    server.registerTool(
      'get_system',
      {
        title: 'Get system',
        description:
          'Returns one system by id, with the list fields plus module, inverter, and battery codes and quantities when OpenSolar sent them.',
        inputSchema: getSystemInputSchema,
        outputSchema: GetSystemOutputSchema,
        annotations: readAnnotations,
      },
      async ({ id }) =>
        runOpenSolarTool(async () => {
          const path = `orgs/${ctx.orgId}/systems/${id}/?fieldset=list`;
          const raw = await ctx.client.get(path);
          const payload = GetSystemOutputSchema.parse(curateSystem(SystemSchema.parse(raw)));
          const name = payload.name ?? '';
          const summary = name === '' ? `System ${id}.` : `System ${id}: ${name}.`;
          return openSolarSuccess(payload, summary);
        }),
    );
  }

  if (enabled.has('get_system_details')) {
    server.registerTool(
      'get_system_details',
      {
        title: 'Get system details',
        description:
          'Returns modules, inverters, batteries, module groups, and incentives for systems on a project the org owns. ' +
          'Shared team projects cannot use this endpoint. ' +
          'include_parts and exclude_parts only filter the upstream `data` field, which is not returned. ' +
          'OpenSolar can time out on large projects; do not retry in a loop. custom_data is omitted.',
        inputSchema: getSystemDetailsInputSchema,
        outputSchema: GetSystemDetailsOutputSchema,
        annotations: readAnnotations,
      },
      async ({ project_id, include_parts, exclude_parts }) =>
        runOpenSolarTool(async () => {
          const query = systemDetailsQuery(include_parts, exclude_parts);
          const path = `orgs/${ctx.orgId}/projects/${project_id}/systems/details/?${query}`;
          const raw = await ctx.client.get(path, { timeoutMs: SYSTEM_DETAILS_TIMEOUT_MS });
          const payload = GetSystemDetailsOutputSchema.parse(
            curateSystemDetails(SystemDetailsResponseSchema.parse(raw)),
          );
          return openSolarSuccess(payload, `${payload.systems.length} system details.`);
        }),
    );
  }

  if (enabled.has('get_system_image')) {
    server.registerTool(
      'get_system_image',
      {
        title: 'Get system image',
        description:
          'Gets a system image. Width and height are required. The server follows redirects. ' +
          'The first call can create a private file on the project, and a later design change regenerates it. ' +
          'The default result is the private file id when the response exposes one, plus content type. ' +
          'include_contents returns the image as MCP image content and refuses a body over 10 MB. Image bytes are not duplicated in structuredContent. The image URL is not returned.',
        inputSchema: getSystemImageInput,
        outputSchema: SystemImageOutputSchema,
        annotations: imageAnnotations,
      },
      async ({ project_id, system_uuid, width, height, include_contents }) =>
        runOpenSolarTool(async () => {
          const params = new URLSearchParams({
            width: String(width),
            height: String(height),
          });
          const path = `orgs/${ctx.orgId}/projects/${project_id}/systems/${encodeURIComponent(system_uuid)}/image/?${params.toString()}`;
          let file: {
            contentType: string | null;
            privateFileId: number | null;
            bytes: Uint8Array | null;
          };
          try {
            file = await ctx.client.getFile(path, {
              timeoutMs: SYSTEM_IMAGE_TIMEOUT_MS,
              readBody: include_contents,
            });
          } catch (error) {
            if (error instanceof OpenSolarApiError && error.status === 413) {
              return oversizeImage;
            }
            throw error;
          }
          if (
            include_contents &&
            file.bytes !== null &&
            file.bytes.byteLength > MAX_PRIVATE_FILE_BYTES
          ) {
            return oversizeImage;
          }
          const contentType = file.contentType;
          let modelBlocks: Awaited<ReturnType<typeof fileModelBlocks>>['blocks'] = [];
          if (include_contents && file.bytes !== null) {
            const model = await fileModelBlocks({
              id: file.privateFileId ?? 0,
              bytes: file.bytes,
              contentType,
            });
            modelBlocks = model.blocks;
          }
          const payload = SystemImageOutputSchema.parse({
            id: file.privateFileId,
            content_type: contentType,
          });
          const summary =
            payload.id === null
              ? `System image for project ${project_id}.`
              : `System image for project ${project_id}. Private file ${payload.id}.`;
          if (modelBlocks.length === 0) {
            return openSolarSuccess(payload, summary);
          }
          return {
            content: [
              { type: 'text' as const, text: summary },
              ...modelBlocks,
              structuredContentText(payload),
            ],
            structuredContent: payload,
          };
        }),
    );
  }
}
