import { afterEach, describe, expect, it, vi } from 'vitest';
import { TIER_POLICY } from '../../src/lib/tier-policy.js';
import { buildServer } from '../../src/server.js';
import { selectTools, TOOLSET_NAMES } from '../../src/tools/index.js';
import { ALL_TOOL_FILTERS, unexpectedCallClient, withMcpClient } from '../helpers/mcp.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

const expectedOrder = [
  'list_projects',
  'search_projects',
  'get_project',
  'get_project_snapshot',
  'create_project',
  'update_project',
  'update_project_stage',
  'update_project_usage',
  'delete_project',
  'get_org',
  'list_roles',
  'get_role',
  'list_contacts',
  'search_contacts',
  'get_contact',
  'create_contact',
  'update_contact',
  'delete_contact',
  'get_event',
  'list_event_types',
  'list_project_systems',
  'compare_project_systems',
  'get_system',
  'get_system_details',
  'get_system_image',
  'list_modules',
  'get_module',
  'delete_module_activation',
  'list_inverters',
  'get_inverter',
  'delete_inverter_activation',
  'list_batteries',
  'get_battery',
  'delete_battery_activation',
  'list_other_components',
  'get_other_component',
  'delete_other_component_activation',
  'list_workflows',
  'get_workflow',
  'create_workflow',
  'delete_workflow',
  'list_payment_options',
  'get_payment_option',
  'delete_payment_option',
  'list_pricing_schemes',
  'get_pricing_scheme',
  'delete_pricing_scheme',
  'list_costings',
  'get_costing',
  'delete_costing',
  'list_roof_types',
  'list_file_tags',
  'list_private_files',
  'get_private_file',
  'create_private_file',
  'update_private_file',
  'delete_private_file',
  'generate_project_document',
  'list_webhooks',
  'create_webhook',
  'update_webhook',
  'list_webhook_logs',
  'list_webhook_queue',
  'list_connected_orgs',
  'preflight_project_share',
  'list_connection_requests',
  'create_connection_request',
  'accept_connection_request',
  'update_connection',
  'delete_connection',
  'share_project',
  'share_entities',
  'create_permission_role',
  'get_proposal_data',
  'get_project_design',
] as const;

const mutationAnnotations = {
  create_contact: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  create_project: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  update_project: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  update_project_stage: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  update_contact: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  update_project_usage: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  delete_project: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  delete_contact: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  delete_module_activation: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  delete_inverter_activation: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  delete_battery_activation: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  delete_other_component_activation: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  delete_pricing_scheme: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  create_workflow: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  delete_workflow: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  delete_payment_option: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  delete_costing: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  create_private_file: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  update_private_file: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  delete_private_file: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  get_system_image: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  generate_project_document: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  create_webhook: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  update_webhook: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  create_connection_request: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  accept_connection_request: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  update_connection: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  delete_connection: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  share_project: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  share_entities: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  create_permission_role: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
} as const;

describe('tool registration', () => {
  it('registers tools in stable order with titles, annotations, and output schemas', async () => {
    const mcp = buildServer({
      client: unexpectedCallClient(),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const listed = await withMcpClient(mcp, (client) => client.listTools());
    expect(listed.tools.map((tool) => tool.name)).toEqual([...expectedOrder]);
    expect(new Set(listed.tools.map((tool) => tool.name))).toEqual(
      new Set(Object.keys(TIER_POLICY)),
    );

    for (const tool of listed.tools) {
      expect(tool.title).toEqual(expect.any(String));
      expect(tool.title?.length).toBeGreaterThan(0);
      expect(tool.outputSchema).toEqual(expect.any(Object));
      const mutation = mutationAnnotations[tool.name as keyof typeof mutationAnnotations];
      expect(tool.annotations).toEqual(
        expect.objectContaining(
          mutation ?? {
            readOnlyHint: true,
            openWorldHint: true,
          },
        ),
      );
    }
  });

  it('advertises JSON Schema 2020-12 input schemas', async () => {
    const mcp = buildServer({
      client: unexpectedCallClient(),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const listed = await withMcpClient(mcp, (client) => client.listTools());
    const byName = Object.fromEntries(listed.tools.map((tool) => [tool.name, tool.inputSchema]));

    expect(Object.keys(byName)).toEqual([...expectedOrder]);
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
      filters: {
        profile: 'full',
        toolsets: ['org'],
        toolsetsExplicit: true,
        readOnly: false,
        plan: undefined,
      },
    });

    const listed = await withMcpClient(mcp, (client) => client.listTools());
    expect(listed.tools.map((tool) => tool.name)).toEqual(['get_org', 'list_roles', 'get_role']);
  });

  it('omits create and update tools when read-only is set', async () => {
    const mcp = buildServer({
      client: unexpectedCallClient(),
      orgId: 1,
      filters: {
        profile: 'full',
        toolsets: [...TOOLSET_NAMES],
        toolsetsExplicit: false,
        readOnly: true,
        plan: undefined,
      },
    });

    const listed = await withMcpClient(mcp, (client) => client.listTools());
    const names = listed.tools.map((tool) => tool.name);
    expect(names).toContain('list_projects');
    expect(names).toContain('get_contact');
    expect(names).not.toContain('create_contact');
    expect(names).not.toContain('create_project');
    expect(names).not.toContain('update_project');
    expect(names).not.toContain('update_project_stage');
    expect(names).not.toContain('update_contact');
    expect(names).not.toContain('update_project_usage');
    expect(names).not.toContain('delete_project');
    expect(names).not.toContain('delete_contact');
    expect(names).not.toContain('delete_module_activation');
    expect(names).not.toContain('delete_inverter_activation');
    expect(names).not.toContain('delete_battery_activation');
    expect(names).not.toContain('delete_other_component_activation');
    expect(names).not.toContain('delete_pricing_scheme');
    expect(names).not.toContain('create_workflow');
    expect(names).not.toContain('delete_workflow');
    expect(names).not.toContain('delete_payment_option');
    expect(names).not.toContain('delete_costing');
    expect(names).not.toContain('create_private_file');
    expect(names).not.toContain('update_private_file');
    expect(names).not.toContain('delete_private_file');
    expect(names).not.toContain('get_system_image');
    expect(names).not.toContain('generate_project_document');
    expect(names).not.toContain('create_webhook');
    expect(names).not.toContain('update_webhook');
    expect(names).not.toContain('create_connection_request');
    expect(names).not.toContain('accept_connection_request');
    expect(names).not.toContain('update_connection');
    expect(names).not.toContain('delete_connection');
    expect(names).not.toContain('share_project');
    expect(names).not.toContain('share_entities');
    expect(names).not.toContain('create_permission_role');
    expect(names).toContain('list_connected_orgs');
    expect(names).toContain('list_connection_requests');
    expect(names).toContain('list_webhooks');
    expect(names).toContain('list_webhook_logs');
    expect(names).toContain('list_webhook_queue');
    expect(names).toContain('get_proposal_data');
    expect(names).toContain('get_project_design');
  });
});

describe('selectTools', () => {
  it('returns every registered tool in stable order', () => {
    expect(selectTools(ALL_TOOL_FILTERS)).toEqual([...expectedOrder]);
  });

  it('returns component lists and detail reads in toolset order', () => {
    expect(
      selectTools({
        profile: 'full',
        toolsets: ['components'],
        toolsetsExplicit: true,
        readOnly: false,
        plan: undefined,
      }),
    ).toEqual([
      'list_modules',
      'get_module',
      'delete_module_activation',
      'list_inverters',
      'get_inverter',
      'delete_inverter_activation',
      'list_batteries',
      'get_battery',
      'delete_battery_activation',
      'list_other_components',
      'get_other_component',
      'delete_other_component_activation',
    ]);
  });

  it('omits create and update tools when read-only is set', () => {
    const reads = expectedOrder.filter((name) => !(name in mutationAnnotations));
    expect(
      selectTools({
        profile: 'full',
        toolsets: [...TOOLSET_NAMES],
        toolsetsExplicit: false,
        readOnly: true,
        plan: undefined,
      }),
    ).toEqual([...reads]);
    expect(reads).toContain('list_projects');
    expect(reads).toContain('search_projects');
    expect(reads).toContain('get_project_snapshot');
    expect(reads).toContain('search_contacts');
    expect(reads).not.toContain('create_contact');
    expect(reads).not.toContain('create_project');
    expect(reads).not.toContain('update_project');
    expect(reads).not.toContain('update_project_stage');
    expect(reads).not.toContain('update_contact');
    expect(reads).not.toContain('update_project_usage');
    expect(reads).not.toContain('delete_project');
    expect(reads).not.toContain('delete_contact');
    expect(reads).not.toContain('delete_module_activation');
    expect(reads).not.toContain('delete_inverter_activation');
    expect(reads).not.toContain('delete_battery_activation');
    expect(reads).not.toContain('delete_other_component_activation');
    expect(reads).not.toContain('delete_pricing_scheme');
    expect(reads).not.toContain('create_workflow');
    expect(reads).not.toContain('delete_workflow');
    expect(reads).not.toContain('delete_payment_option');
    expect(reads).not.toContain('delete_costing');
    expect(reads).not.toContain('create_private_file');
    expect(reads).not.toContain('update_private_file');
    expect(reads).not.toContain('delete_private_file');
    expect(reads).not.toContain('get_system_image');
    expect(reads).not.toContain('generate_project_document');
    expect(reads).not.toContain('create_webhook');
    expect(reads).not.toContain('update_webhook');
    expect(reads).not.toContain('create_connection_request');
    expect(reads).not.toContain('accept_connection_request');
    expect(reads).not.toContain('update_connection');
    expect(reads).not.toContain('delete_connection');
    expect(reads).not.toContain('share_project');
    expect(reads).not.toContain('share_entities');
    expect(reads).not.toContain('create_permission_role');
    expect(reads).toContain('list_connected_orgs');
    expect(reads).toContain('list_connection_requests');
    expect(reads).toContain('list_webhooks');
    expect(reads).toContain('get_proposal_data');
    expect(reads).toContain('get_project_design');
  });

  it('omits raw data tools when the plan is api_access', () => {
    const selected = selectTools({
      profile: 'full',
      toolsets: [...TOOLSET_NAMES],
      toolsetsExplicit: false,
      readOnly: false,
      plan: 'api_access',
    });
    expect(selected).not.toContain('get_proposal_data');
    expect(selected).not.toContain('get_project_design');
    expect(selected).toContain('list_projects');
  });
});
