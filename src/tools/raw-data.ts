import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { openSolarSuccess, runOpenSolarTool } from '../client/errors.js';
import type { OpenSolarClient } from '../client/index.js';
import type { ToolName } from '../lib/tier-policy.js';
import {
  DesignSectionSchema,
  ProjectDesignOutputSchema,
  projectDesign,
} from '../schemas/design.js';
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
    section: DesignSectionSchema.default('summary').describe(
      'summary returns system count and system_price_including_tax. ' +
        'components and energy are unmapped because those keys are not named. ' +
        'geometry reports whether autoFacetsGeoJson is present and does not return coordinates. ' +
        'financials returns numeric pricing keys found on each system.',
    ),
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
        'Reads the compressed design on one project. section defaults to summary: system count and system_price_including_tax. ' +
        'components and energy return unmapped true because the decompress section does not name those keys. ' +
        'geometry reports whether autoFacetsGeoJson is present and does not return coordinates. ' +
        'financials returns numeric pricing keys on each system and does not return pricing objects. ' +
        'Requires Raw Data API Access. A missing or null design returns design_available false. A 402 means Raw Data is missing. ' +
        'The compressed string is not returned. get_project verbose still replaces design with [REDACTED].',
      inputSchema: designInput,
      outputSchema: ProjectDesignOutputSchema,
      annotations: readAnnotations,
    },
    async ({ project_id, section }) =>
      runOpenSolarTool(async () => {
        const raw = await ctx.client.get(`orgs/${ctx.orgId}/projects/${project_id}/`);
        const project = asProject(raw);
        if (project === null) {
          return undecodableDesign;
        }
        const projected = projectDesign(project.design, section);
        if (!projected.ok) {
          return undecodableDesign;
        }
        const payload = ProjectDesignOutputSchema.parse(projected.design);
        return openSolarSuccess(payload, designSummary(project_id, payload));
      }),
  );
}

function designSummary(
  projectId: number,
  payload: {
    design_available: boolean;
    section?: string;
    unmapped?: boolean;
    system_count?: number;
  },
): string {
  if (!payload.design_available) {
    return `Design for project ${projectId} is not available.`;
  }
  if (payload.unmapped === true) {
    return `Design section ${payload.section} for project ${projectId} is unmapped.`;
  }
  if (payload.section === 'summary') {
    return `Design for project ${projectId}: ${payload.system_count} systems.`;
  }
  return `Design section ${payload.section} for project ${projectId}.`;
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
