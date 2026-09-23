import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { openSolarSuccess, runOpenSolarTool } from '../client/errors.js';
import type { OpenSolarClient } from '../client/index.js';
import { FILE_TAGS } from '../lib/enums/file-tags.js';
import { ROOF_TYPES } from '../lib/enums/roof-types.js';
import type { ToolName } from '../lib/tier-policy.js';

export interface ReferenceContext {
  client: OpenSolarClient;
  orgId: number;
}

const readAnnotations = { readOnlyHint: true, openWorldHint: true } as const;

const IdTitleSchema = z.object({
  id: z.number().int(),
  title: z.string(),
});

const ListRoofTypesOutputSchema = z.object({
  roof_types: z.array(IdTitleSchema),
});

const ListFileTagsOutputSchema = z.object({
  file_tags: z.array(z.object({ title: z.string() })),
});

const emptyInput = z.object({});

export function registerReferenceToolset(
  server: McpServer,
  _ctx: ReferenceContext,
  enabled: ReadonlySet<ToolName>,
): void {
  if (enabled.has('list_roof_types')) {
    registerListRoofTypes(server);
  }
  if (enabled.has('list_file_tags')) {
    registerListFileTags(server);
  }
}

function registerListRoofTypes(server: McpServer): void {
  server.registerTool(
    'list_roof_types',
    {
      title: 'List roof types',
      description:
        'Returns the OpenSolar roof type ids and titles. This is a copied docs table, not an API call.',
      inputSchema: emptyInput,
      outputSchema: ListRoofTypesOutputSchema,
      annotations: readAnnotations,
    },
    async () =>
      runOpenSolarTool(async () => {
        const roofTypes = Object.entries(ROOF_TYPES).map(([id, title]) => ({
          id: Number(id),
          title,
        }));
        const payload = ListRoofTypesOutputSchema.parse({ roof_types: roofTypes });
        return openSolarSuccess(payload, `${payload.roof_types.length} roof types.`);
      }),
  );
}

function registerListFileTags(server: McpServer): void {
  server.registerTool(
    'list_file_tags',
    {
      title: 'List file tags',
      description:
        'Returns private-file tag titles. The title is the identifier. This is a copied docs table, not an API call.',
      inputSchema: emptyInput,
      outputSchema: ListFileTagsOutputSchema,
      annotations: readAnnotations,
    },
    async () =>
      runOpenSolarTool(async () => {
        const fileTags = FILE_TAGS.map((title) => ({ title }));
        const payload = ListFileTagsOutputSchema.parse({ file_tags: fileTags });
        return openSolarSuccess(payload, `${payload.file_tags.length} file tags.`);
      }),
  );
}
