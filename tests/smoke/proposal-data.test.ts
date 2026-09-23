import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { OpenSolarApiError } from '../../src/client/index.js';
import { ProposalDataOutputSchema } from '../../src/schemas/proposal.js';
import { buildServer } from '../../src/server.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

function gzipJson(value: unknown): string {
  return gzipSync(Buffer.from(JSON.stringify(value))).toString('base64');
}

const designBlob = gzipJson({ scene: { panels: [{ x: 1, y: 2 }] } });
const outputBlob = gzipJson({
  hourly: [0.1, 0.2],
  shadingByPanelGroup: [[1, 2]],
});

function proposalResponse() {
  return [
    {
      id: 62854,
      name: 'Demo Solar Co.',
      projects: [
        {
          id: 42,
          address: '6 Hopetoun Ave',
          api_key_chat: 'CHAT-SHOULD-NOT-LEAK',
          proposal_data: {
            design: designBlob,
            share_link_qrcode: 'QR-SHOULD-NOT-LEAK',
            systems: [
              {
                name: 'System 1',
                title: 'System 1 (6.21 kW)',
                systemOutputAnnualkWh: '8,547',
                output_monthly_json: '[680,720,710,690,700,680,690,710,700,680,670,690]',
                systemPaybackYear: '4.2',
                systemNetPresentValue: '$12,340',
                systemIrr: '12%',
                systemReturnOnInvestment: '18%',
                panelOrientations: '18 panels facing North',
                data: {
                  pricing: { price: 99999 },
                  line_items: [{ label: 'panels' }],
                  payment_options: [{ name: 'Cash' }],
                  output: outputBlob,
                  site: { panelCoordinates: [1, 2] },
                },
              },
            ],
          },
        },
      ],
    },
  ];
}

describe('get_proposal_data', () => {
  it('requests one project and returns the named figures without blobs', async () => {
    const calls: string[] = [];
    const client = testClient(async (path) => {
      calls.push(path);
      return proposalResponse();
    });
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'get_proposal_data', arguments: { project_id: 42 } }),
    );
    const payload = ProposalDataOutputSchema.parse(requireStructuredContent(result));
    const serialized = JSON.stringify(result);

    expect(calls).toEqual(['user_logins/?project_ids=42']);
    expect(payload).toEqual({
      project_id: 42,
      systems: [
        {
          name: 'System 1',
          annual_kwh: 8547,
          monthly_kwh: [680, 720, 710, 690, 700, 680, 690, 710, 700, 680, 670, 690],
          payback_year: '4.2',
          net_present_value: '$12,340',
          irr: '12%',
          return_on_investment: '18%',
        },
      ],
    });
    expect(serialized).not.toContain('H4sI');
    expect(serialized).not.toContain(designBlob);
    expect(serialized).not.toContain(outputBlob);
    expect(serialized).not.toContain('panelCoordinates');
    expect(serialized).not.toContain('hourly');
    expect(serialized).not.toContain('CHAT-SHOULD-NOT-LEAK');
    expect(serialized).not.toContain('QR-SHOULD-NOT-LEAK');
    expect(serialized).not.toContain('99999');
  });

  it('reads annual and monthly figures from a compressed output string', async () => {
    const compressed = gzipJson({
      systemOutputAnnualkWh: 1000,
      output_monthly_json: [10, 20, 30],
      hourly: [1, 2, 3, 4],
    });
    const client = testClient(async () => [
      {
        projects: [
          {
            id: 42,
            proposal_data: {
              systems: [{ name: 'Hidden output', data: { output: compressed } }],
            },
          },
        ],
      },
    ]);
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'get_proposal_data', arguments: { project_id: 42 } }),
    );
    const payload = ProposalDataOutputSchema.parse(requireStructuredContent(result));

    expect(payload.systems).toEqual([
      {
        name: 'Hidden output',
        annual_kwh: 1000,
        monthly_kwh: [10, 20, 30],
        payback_year: null,
        net_present_value: null,
        irr: null,
        return_on_investment: null,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain(compressed);
    expect(JSON.stringify(result)).not.toContain('hourly');
  });

  it('maps HTTP 402 to the Raw Data message', async () => {
    const client = testClient(async () => {
      throw new OpenSolarApiError('payment', 402, '{"detail":"BODY-SHOULD-NOT-LEAK"}');
    });
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'get_proposal_data', arguments: { project_id: 42 } }),
    );

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: 'This call needs Raw Data API Access' }]);
    expect(JSON.stringify(result)).not.toContain('BODY-SHOULD-NOT-LEAK');
  });

  it('rejects a project id list before HTTP', async () => {
    const calls: string[] = [];
    const client = testClient(async (path) => {
      calls.push(path);
      return [];
    });
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'get_proposal_data',
        arguments: { project_id: 42, project_ids: [42, 43] },
      }),
    );

    expect(result.isError).toBe(true);
    expect(calls).toEqual([]);
  });
});
