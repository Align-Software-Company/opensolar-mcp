import { describe, expect, it } from 'vitest';
import { ConfigError, loadToolFilters } from '../../src/lib/config.js';
import { TIER_POLICY } from '../../src/lib/tier-policy.js';
import { buildServer } from '../../src/server.js';
import { selectTools, TOOLSET_NAMES, TOOLSET_TOOLS } from '../../src/tools/index.js';
import { AGENT_PROFILE_TOOLS } from '../fixtures/agent-profile.js';
import { unexpectedCallClient, withMcpClient } from '../helpers/mcp.js';

const agentFilters = loadToolFilters({});

describe('OPENSOLAR_PROFILE', () => {
  it('defaults to the agent profile when profile and toolsets are absent', () => {
    expect(agentFilters.profile).toBe('agent');
    expect(agentFilters.toolsetsExplicit).toBe(false);
    expect(selectTools(agentFilters)).toEqual([...AGENT_PROFILE_TOOLS]);
    expect(AGENT_PROFILE_TOOLS).toHaveLength(32);
  });

  it('returns all 75 registered tools for the full profile', () => {
    const registered = TOOLSET_NAMES.flatMap((toolset) => [...TOOLSET_TOOLS[toolset]]);
    const selected = selectTools(loadToolFilters({ OPENSOLAR_PROFILE: 'full' }));
    expect(registered).toHaveLength(75);
    expect(selected).toEqual(registered);
    expect(selected).toHaveLength(75);
  });

  it('omits raw data tools from the agent profile on API Access', () => {
    const selected = selectTools(
      loadToolFilters({ OPENSOLAR_PROFILE: 'agent', OPENSOLAR_PLAN: 'api_access' }),
    );
    expect(selected).toEqual(
      AGENT_PROFILE_TOOLS.filter(
        (name) => name !== 'get_proposal_data' && name !== 'get_project_design',
      ),
    );
    expect(selected).toHaveLength(30);
    expect(selected).not.toContain('get_proposal_data');
    expect(selected).not.toContain('get_project_design');
  });

  it('keeps agent reads and drops agent mutations when read-only', () => {
    const selected = selectTools(
      loadToolFilters({ OPENSOLAR_PROFILE: 'agent', OPENSOLAR_READ_ONLY: '1' }),
    );
    const reads = AGENT_PROFILE_TOOLS.filter((name) => !TIER_POLICY[name].mutation);
    expect(selected).toEqual([...reads]);
    expect(selected).toHaveLength(22);
    expect(selected).toContain('list_projects');
    expect(selected).toContain('get_project_snapshot');
    expect(selected).toContain('compare_project_systems');
    expect(selected).not.toContain('create_project');
    expect(selected).not.toContain('share_project');
    expect(selected).not.toContain('list_modules');
    expect(selected).not.toContain('get_role');
    expect(selected).not.toContain('list_webhooks');
    expect(selected).not.toContain('list_workflows');
    expect(selected).not.toContain('get_event');
  });

  it('exposes webhooks when that toolset is set and no profile is set', () => {
    const selected = selectTools(loadToolFilters({ OPENSOLAR_TOOLSETS: 'webhooks' }));
    expect(selected).toEqual([
      'list_webhooks',
      'create_webhook',
      'update_webhook',
      'list_webhook_logs',
      'list_webhook_queue',
    ]);
  });

  it('exposes the components toolset when the agent profile is also set', () => {
    const selected = selectTools(
      loadToolFilters({ OPENSOLAR_PROFILE: 'agent', OPENSOLAR_TOOLSETS: 'components' }),
    );
    expect(selected).toEqual([...TOOLSET_TOOLS.components]);
    expect(selected).toContain('delete_module_activation');
  });

  it('still removes component deletes when read-only overrides an explicit toolset', () => {
    const selected = selectTools(
      loadToolFilters({
        OPENSOLAR_PROFILE: 'agent',
        OPENSOLAR_TOOLSETS: 'components',
        OPENSOLAR_READ_ONLY: '1',
      }),
    );
    expect(selected).toEqual([
      'list_modules',
      'get_module',
      'list_inverters',
      'get_inverter',
      'list_batteries',
      'get_battery',
      'list_other_components',
      'get_other_component',
    ]);
    expect(selected).not.toContain('delete_module_activation');
  });

  it('rejects an unknown profile', () => {
    expect(() => loadToolFilters({ OPENSOLAR_PROFILE: 'banana' })).toThrow(ConfigError);
    expect(() => loadToolFilters({ OPENSOLAR_PROFILE: 'banana' })).toThrow(/OPENSOLAR_PROFILE/);
  });

  it('registers the same surface from one filter set', async () => {
    const filters = loadToolFilters({ OPENSOLAR_PROFILE: 'agent' });
    const first = buildServer({ client: unexpectedCallClient(), orgId: 1, filters });
    const second = buildServer({ client: unexpectedCallClient(), orgId: 1, filters });
    const [left, right] = await Promise.all([
      withMcpClient(first, (client) => client.listTools()),
      withMcpClient(second, (client) => client.listTools()),
    ]);
    const leftNames = left.tools.map((tool) => tool.name);
    const rightNames = right.tools.map((tool) => tool.name);
    expect(leftNames).toEqual(rightNames);
    expect(leftNames).toEqual(selectTools(filters));
  });
});
