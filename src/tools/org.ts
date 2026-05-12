import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { OpenSolarClient } from '../client/index.js';
import { curateOrg, OrgSchema } from '../schemas/org.js';

export interface OrgContext {
  client: OpenSolarClient;
  orgId: number;
}

const getOrgInputShape = {
  verbose: z
    .boolean()
    .default(false)
    .describe(
      'When true, returns the full unfiltered org payload (~27 KB) including billing ' +
        'config, integration credentials (Stripe/Salesforce/PandaDoc/etc.), nested role/' +
        'module/inverter/battery/incentive arrays, and all enable_* feature flags. ' +
        'Default false returns a curated subset suitable for routine LLM context.',
    ),
};

const getOrgDescription =
  "Returns the user's OpenSolar organization details: id, name, physical address, " +
  'country, contact info, measurement units, and service-offering identifiers. Use when ' +
  "the user asks 'what org am I connected to', 'what country/units does this account use', " +
  'or to confirm the active org before performing a workflow. Curated by default; pass ' +
  '`verbose: true` for the full ~27 KB payload (billing, integrations, feature flags, ' +
  'nested catalogs). Field names follow OpenSolar conventions: phone is `sales_phone_number`, ' +
  'website is `company_website`; locale and timezone are not surfaced at the org level. ' +
  'Tier: API Access (uniform across plans, no degradation).';

export function registerOrgToolset(server: McpServer, ctx: OrgContext): void {
  server.registerTool(
    'get_org',
    {
      description: getOrgDescription,
      inputSchema: getOrgInputShape,
    },
    async ({ verbose }) => {
      const path = `orgs/${ctx.orgId}/`;
      const raw = await ctx.client.get(path);
      const org = OrgSchema.parse(raw);
      const payload = verbose ? org : curateOrg(org);
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      };
    },
  );
}
