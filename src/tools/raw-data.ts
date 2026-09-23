import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { openSolarSuccess, runOpenSolarTool } from '../client/errors.js';
import type { OpenSolarClient } from '../client/index.js';
import type { ToolName } from '../lib/tier-policy.js';
import { ProjectDesignOutputSchema, summarizeDesign } from '../schemas/design.js';
import {
  curateProposalSystems,
  ProposalDataOutputSchema,
  projectRecord,
} from '../schemas/proposal.js';

export interface RawDataContext {
  client: OpenSolarClient;
  orgId: number;
}

const readAnnotations = { readOnlyHint: true, openWorldHint: true } as const;

const proposalInput = z
  .object({
    project_id: z.number().int().positive().describe('Project id from list_projects.'),
  })
  .strict();

const missingProject = (projectId: number) => ({
  isError: true as const,
  content: [{ type: 'text' as const, text: `Proposal data did not include project ${projectId}.` }],
});

export function registerRawDataToolset(
  server: McpServer,
  ctx: RawDataContext,
  enabled: ReadonlySet<ToolName>,
): void {
  if (enabled.has('get_proposal_data')) {
    registerGetProposalData(server, ctx);
  }
  if (enabled.has('get_project_design')) {
    registerGetProjectDesign(server, ctx);
  }
}

function registerGetProposalData(server: McpServer, ctx: RawDataContext): void {
  server.registerTool(
    'get_proposal_data',
    {
      title: 'Get proposal data',
      description:
        'Returns proposal figures for one project: system name, annual kWh, monthly kWh, payback year, net present value, IRR, and return on investment. ' +
        'Requires Raw Data API Access. A 402 means this org does not have that plan. One inaccessible project returns 403. ' +
        'A compressed output string is decoded on the server and is not returned.',
      inputSchema: proposalInput,
      outputSchema: ProposalDataOutputSchema,
      annotations: readAnnotations,
    },
    async ({ project_id }) =>
      runOpenSolarTool(async () => {
        const raw = await ctx.client.get(`user_logins/?project_ids=${project_id}`);
        const project = projectRecord(raw, project_id);
        if (project === null) {
          return missingProject(project_id);
        }
        const payload = ProposalDataOutputSchema.parse({
          project_id,
          systems: curateProposalSystems(project),
        });
        const count = payload.systems.length;
        const summary =
          count === 1
            ? `Proposal for project ${project_id}: 1 system.`
            : `Proposal for project ${project_id}: ${count} systems.`;
        return openSolarSuccess(payload, summary);
      }),
  );
}

const designInput = z
  .object({
    project_id: z.number().int().positive().describe('Project id from list_projects.'),
  })
  .strict();

const undecodableDesign = {
  isError: true as const,
  content: [{ type: 'text' as const, text: 'Project design could not be decoded.' }],
};

function registerGetProjectDesign(server: McpServer, ctx: RawDataContext): void {
  server.registerTool(
    'get_project_design',
    {
      title: 'Get project design',
      description:
        'Reads the compressed design on one project and returns the system count and system_price_including_tax. ' +
        'Requires Raw Data API Access. A missing or null design returns design_available false. ' +
        'The compressed string is not returned. get_project verbose still replaces design with [REDACTED].',
      inputSchema: designInput,
      outputSchema: ProjectDesignOutputSchema,
      annotations: readAnnotations,
    },
    async ({ project_id }) =>
      runOpenSolarTool(async () => {
        const raw = await ctx.client.get(`orgs/${ctx.orgId}/projects/${project_id}/`);
        const project = asProject(raw);
        if (project === null) {
          return undecodableDesign;
        }
        const summarized = summarizeDesign(project.design);
        if (!summarized.ok) {
          return undecodableDesign;
        }
        const payload = ProjectDesignOutputSchema.parse(summarized.summary);
        const summary = payload.design_available
          ? `Design for project ${project_id}: ${payload.system_count} systems.`
          : `Design for project ${project_id} is not available.`;
        return openSolarSuccess(payload, summary);
      }),
  );
}

function asProject(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    record[key] = entry;
  }
  return record;
}
