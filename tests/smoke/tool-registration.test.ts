import { afterEach, describe, expect, it, vi } from 'vitest';
import { TIER_POLICY } from '../../src/lib/tier-policy.js';
import { buildServer } from '../../src/server.js';
import { selectTools, TOOLSET_NAMES } from '../../src/tools/index.js';
import { ALL_TOOL_FILTERS, unexpectedCallClient, withMcpClient } from '../helpers/mcp.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

const expectedTools = Object.keys(TIER_POLICY);

describe('tool registration', () => {
  it('registers exactly the tools listed in TIER_POLICY', async () => {
    const mcp = buildServer({
      client: unexpectedCallClient(),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const listed = await withMcpClient(mcp, (client) => client.listTools());
    const names = listed.tools.map((tool) => tool.name).sort();
    expect(names).toEqual([...expectedTools].sort());
  });

  it('advertises JSON Schema 2020-12 input schemas', async () => {
    const mcp = buildServer({
      client: unexpectedCallClient(),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const listed = await withMcpClient(mcp, (client) => client.listTools());
    const byName = Object.fromEntries(listed.tools.map((tool) => [tool.name, tool.inputSchema]));

    expect(Object.keys(byName).sort()).toEqual([...expectedTools].sort());
    for (const schema of Object.values(byName)) {
      expect(schema).toEqual(
        expect.objectContaining({
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          type: 'object',
        }),
      );
    }

    expect(byName.list_projects).toEqual(
      expect.objectContaining({
        properties: expect.objectContaining({
          limit: expect.any(Object),
          page: expect.any(Object),
          verbose: expect.any(Object),
        }),
      }),
    );
    expect(byName.get_project).toEqual(
      expect.objectContaining({
        properties: expect.objectContaining({
          id: expect.any(Object),
          verbose: expect.any(Object),
        }),
      }),
    );
    expect(byName.get_org).toEqual(
      expect.objectContaining({
        properties: expect.objectContaining({
          verbose: expect.any(Object),
        }),
      }),
    );
    expect(byName.list_contacts).toEqual(
      expect.objectContaining({
        properties: expect.objectContaining({
          page: expect.any(Object),
          limit: expect.any(Object),
          ordering: expect.any(Object),
        }),
      }),
    );
    expect(byName.get_contact).toEqual(
      expect.objectContaining({
        properties: expect.objectContaining({
          contact_id: expect.any(Object),
        }),
      }),
    );
    expect(byName.get_event).toEqual(
      expect.objectContaining({
        properties: expect.objectContaining({
          event_id: expect.any(Object),
        }),
      }),
    );
  });

  it('filters the registered surface by toolset', async () => {
    const mcp = buildServer({
      client: unexpectedCallClient(),
      orgId: 1,
      filters: { toolsets: ['org'], readOnly: false, plan: undefined },
    });

    const listed = await withMcpClient(mcp, (client) => client.listTools());
    expect(listed.tools.map((tool) => tool.name)).toEqual(['get_org']);
  });
});

describe('selectTools', () => {
  it('returns every registered tool by default', () => {
    expect(selectTools(ALL_TOOL_FILTERS).sort()).toEqual([...expectedTools].sort());
  });

  it('keeps current tools under read-only because none mutate', () => {
    expect(
      selectTools({ toolsets: [...TOOLSET_NAMES], readOnly: true, plan: undefined }).sort(),
    ).toEqual([...expectedTools].sort());
  });
});
