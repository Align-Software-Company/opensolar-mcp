import type { McpServer } from '@modelcontextprotocol/server';
import type { OpenSolarClient } from '../client/index.js';
import { TIER_POLICY, type ToolName } from '../lib/tier-policy.js';
import { registerComponentsToolset } from './components.js';
import { registerCostingToolset } from './costing.js';
import { registerCrmToolset } from './crm.js';
import { registerEventsToolset } from './events.js';
import { registerFilesToolset } from './files.js';
import { registerOrgToolset } from './org.js';
import { registerPaymentToolset } from './payment.js';
import { registerPricingToolset } from './pricing.js';
import { registerProjectsToolset } from './projects.js';
import { registerRawDataToolset } from './raw-data.js';
import { registerReferenceToolset } from './reference.js';
import { registerSystemsToolset } from './systems.js';
import { registerTeamsToolset } from './teams.js';
import { registerWebhooksToolset } from './webhooks.js';
import { registerWorkflowToolset } from './workflow.js';

export const TOOLSET_NAMES = [
  'projects',
  'org',
  'contacts',
  'events',
  'systems',
  'components',
  'workflow',
  'payment',
  'pricing',
  'costing',
  'reference',
  'files',
  'webhooks',
  'teams',
  'raw_data',
] as const;
export type ToolsetName = (typeof TOOLSET_NAMES)[number];

export const TOOLSET_TOOLS: Record<ToolsetName, readonly ToolName[]> = {
  projects: [
    'list_projects',
    'search_projects',
    'get_project',
    'get_project_snapshot',
    'create_project',
    'update_project',
    'update_project_stage',
    'update_project_usage',
    'delete_project',
  ],
  org: ['get_org', 'list_roles', 'get_role'],
  contacts: [
    'list_contacts',
    'search_contacts',
    'get_contact',
    'create_contact',
    'update_contact',
    'delete_contact',
  ],
  events: ['get_event', 'list_event_types'],
  systems: ['list_project_systems', 'get_system', 'get_system_details', 'get_system_image'],
  components: [
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
  ],
  workflow: ['list_workflows', 'get_workflow', 'create_workflow', 'delete_workflow'],
  payment: ['list_payment_options', 'get_payment_option', 'delete_payment_option'],
  pricing: ['list_pricing_schemes', 'get_pricing_scheme', 'delete_pricing_scheme'],
  costing: ['list_costings', 'get_costing', 'delete_costing'],
  reference: ['list_roof_types', 'list_file_tags'],
  files: [
    'list_private_files',
    'get_private_file',
    'create_private_file',
    'update_private_file',
    'delete_private_file',
    'generate_project_document',
  ],
  webhooks: [
    'list_webhooks',
    'create_webhook',
    'update_webhook',
    'list_webhook_logs',
    'list_webhook_queue',
  ],
  teams: [
    'list_connected_orgs',
    'list_connection_requests',
    'create_connection_request',
    'accept_connection_request',
    'update_connection',
    'delete_connection',
    'share_project',
    'share_entities',
    'create_permission_role',
  ],
  raw_data: ['get_proposal_data', 'get_project_design'],
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
  const requested = new Set(filters.toolsets);
  const selected: ToolName[] = [];
  for (const toolset of TOOLSET_NAMES) {
    if (!requested.has(toolset)) {
      continue;
    }
    for (const name of TOOLSET_TOOLS[toolset]) {
      const policy = TIER_POLICY[name];
      if (filters.readOnly && policy.mutation) {
        continue;
      }
      if (!allowedForPlan(filters.plan, policy.requires)) {
        continue;
      }
      selected.push(name);
    }
  }
  return selected;
}

export function registerAllToolsets(
  server: McpServer,
  ctx: ToolContext,
  filters: ToolFilters,
): void {
  const enabled = new Set(selectTools(filters));
  if (
    enabled.has('list_projects') ||
    enabled.has('search_projects') ||
    enabled.has('get_project') ||
    enabled.has('get_project_snapshot') ||
    enabled.has('create_project') ||
    enabled.has('update_project') ||
    enabled.has('update_project_stage') ||
    enabled.has('update_project_usage') ||
    enabled.has('delete_project')
  ) {
    registerProjectsToolset(server, ctx, enabled);
  }
  if (enabled.has('get_org') || enabled.has('list_roles') || enabled.has('get_role')) {
    registerOrgToolset(server, ctx, enabled);
  }
  if (
    enabled.has('list_contacts') ||
    enabled.has('search_contacts') ||
    enabled.has('get_contact') ||
    enabled.has('create_contact') ||
    enabled.has('update_contact') ||
    enabled.has('delete_contact')
  ) {
    registerCrmToolset(server, ctx, enabled);
  }
  if (enabled.has('get_event') || enabled.has('list_event_types')) {
    registerEventsToolset(server, ctx, enabled);
  }
  if (
    enabled.has('list_project_systems') ||
    enabled.has('get_system') ||
    enabled.has('get_system_details') ||
    enabled.has('get_system_image')
  ) {
    registerSystemsToolset(server, ctx, enabled);
  }
  if (TOOLSET_TOOLS.components.some((name) => enabled.has(name))) {
    registerComponentsToolset(server, ctx, enabled);
  }
  if (TOOLSET_TOOLS.workflow.some((name) => enabled.has(name))) {
    registerWorkflowToolset(server, ctx, enabled);
  }
  if (TOOLSET_TOOLS.payment.some((name) => enabled.has(name))) {
    registerPaymentToolset(server, ctx, enabled);
  }
  if (TOOLSET_TOOLS.pricing.some((name) => enabled.has(name))) {
    registerPricingToolset(server, ctx, enabled);
  }
  if (TOOLSET_TOOLS.costing.some((name) => enabled.has(name))) {
    registerCostingToolset(server, ctx, enabled);
  }
  if (enabled.has('list_roof_types') || enabled.has('list_file_tags')) {
    registerReferenceToolset(server, ctx, enabled);
  }
  if (TOOLSET_TOOLS.files.some((name) => enabled.has(name))) {
    registerFilesToolset(server, ctx, enabled);
  }
  if (TOOLSET_TOOLS.webhooks.some((name) => enabled.has(name))) {
    registerWebhooksToolset(server, ctx, enabled);
  }
  if (TOOLSET_TOOLS.teams.some((name) => enabled.has(name))) {
    registerTeamsToolset(server, ctx, enabled);
  }
  if (TOOLSET_TOOLS.raw_data.some((name) => enabled.has(name))) {
    registerRawDataToolset(server, ctx, enabled);
  }
}
