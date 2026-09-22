import type { McpServer } from '@modelcontextprotocol/server';
import type { OpenSolarClient } from '../client/index.js';
import { TIER_POLICY, type ToolName } from '../lib/tier-policy.js';
import { registerCrmToolset } from './crm.js';
import { registerEventsToolset } from './events.js';
import { registerOrgToolset } from './org.js';
import { registerProjectsToolset } from './projects.js';

export const TOOLSET_NAMES = ['projects', 'contacts', 'events', 'org'] as const;
export type ToolsetName = (typeof TOOLSET_NAMES)[number];

export const TOOLSET_TOOLS: Record<ToolsetName, readonly ToolName[]> = {
  projects: ['list_projects', 'get_project'],
  contacts: ['list_contacts', 'get_contact'],
  events: ['get_event'],
  org: ['get_org'],
};

export interface ToolContext {
  client: OpenSolarClient;
  orgId: number;
}

export interface ToolFilters {
  toolsets: readonly ToolsetName[];
  readOnly: boolean;
  plan: 'api_access' | 'raw_data' | undefined;
}

export function isToolsetName(value: string): value is ToolsetName {
  return (TOOLSET_NAMES as readonly string[]).includes(value);
}

function allowedForPlan(plan: ToolFilters['plan'], requires: string): boolean {
  return !(plan === 'api_access' && requires === 'raw_data');
}

export function selectTools(filters: ToolFilters): ToolName[] {
  const allowed = new Set<ToolName>();
  for (const toolset of filters.toolsets) {
    for (const name of TOOLSET_TOOLS[toolset]) {
      allowed.add(name);
    }
  }

  return [...allowed].filter((name) => {
    const policy = TIER_POLICY[name];
    if (filters.readOnly && policy.mutation) {
      return false;
    }
    return allowedForPlan(filters.plan, policy.requires);
  });
}

export function registerAllToolsets(
  server: McpServer,
  ctx: ToolContext,
  filters: ToolFilters,
): void {
  const enabled = new Set(selectTools(filters));
  if (enabled.has('list_projects') || enabled.has('get_project')) {
    registerProjectsToolset(server, ctx, enabled);
  }
  if (enabled.has('get_org')) {
    registerOrgToolset(server, ctx, enabled);
  }
  if (enabled.has('list_contacts') || enabled.has('get_contact')) {
    registerCrmToolset(server, ctx, enabled);
  }
  if (enabled.has('get_event')) {
    registerEventsToolset(server, ctx, enabled);
  }
}
