import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { FILE_TAGS } from '../../src/lib/enums/file-tags.js';
import { buildServer } from '../../src/server.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  unexpectedCallClient,
  withMcpClient,
} from '../helpers/mcp.js';

const eventTypesOutput = z.object({
  event_types: z.array(z.object({ id: z.number(), title: z.string() })),
});

const roofTypesOutput = z.object({
  roof_types: z.array(z.object({ id: z.number(), title: z.string() })),
});

const fileTagsOutput = z.object({
  file_tags: z.array(z.object({ title: z.string() })),
});

describe('local id tables', () => {
  it('lists event types from the copied table and keeps gaps', async () => {
    const mcp = buildServer({
      client: unexpectedCallClient(),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'list_event_types', arguments: {} }),
    );
    const payload = eventTypesOutput.parse(requireStructuredContent(result));

    expect(payload.event_types[0]).toEqual({ id: 0, title: 'Email Invitation Sent' });
    expect(payload.event_types.some((entry) => entry.id === 5)).toBe(false);
    expect(payload.event_types.some((entry) => entry.id === 20)).toBe(true);
  });

  it('lists roof type 6 from the copied table', async () => {
    const mcp = buildServer({
      client: unexpectedCallClient(),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'list_roof_types', arguments: {} }),
    );
    const payload = roofTypesOutput.parse(requireStructuredContent(result));

    expect(payload.roof_types[0]).toEqual({ id: 6, title: 'Composition / Asphalt Shingle' });
    expect(payload.roof_types.at(-1)).toEqual({ id: 24, title: 'Kliplock' });
  });

  it('lists file tag titles and does not invent ids', async () => {
    const mcp = buildServer({
      client: unexpectedCallClient(),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'list_file_tags', arguments: {} }),
    );
    const payload = fileTagsOutput.parse(requireStructuredContent(result));
    const serialized = JSON.stringify(payload);

    expect(payload.file_tags[0]).toEqual({ title: 'AC Disconnect Location' });
    expect(payload.file_tags).toHaveLength(FILE_TAGS.length);
    expect(serialized).not.toContain('"id"');
  });
});
