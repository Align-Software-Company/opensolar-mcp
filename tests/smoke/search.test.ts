import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { loadOpenSolarFixture } from '../fixtures/load-fixture.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

type SearchPayload = {
  matches: Array<Record<string, unknown> & { match: { field: string; type: string } }>;
  search: {
    complete: boolean;
    results_truncated: boolean;
    stopped_by: string;
    pages_scanned: number;
  };
};

function contact(id: number, fields: Record<string, unknown>) {
  return {
    id,
    first_name: 'Pat',
    family_name: 'Example',
    display: 'Pat Example',
    email: `pat${id}@example.test`,
    phone: '2025550100',
    ...fields,
  };
}

async function search(
  name: 'search_contacts' | 'search_projects',
  pages: unknown[][],
  args: Record<string, unknown>,
): Promise<{ payload: SearchPayload; paths: string[] }> {
  const paths: string[] = [];
  const mcp = buildServer({
    client: testClient(async (path) => {
      paths.push(path);
      const page = Number(new URLSearchParams(path.split('?')[1] ?? '').get('page'));
      return pages[page - 1] ?? [];
    }),
    orgId: 1,
    filters: ALL_TOOL_FILTERS,
  });
  const result = await withMcpClient(mcp, (client) => client.callTool({ name, arguments: args }));
  return { payload: requireStructuredContent(result) as SearchPayload, paths };
}

describe('search_contacts', () => {
  const page = [
    contact(1, { email: 'pat@example.test', phone: '2025550100' }),
    contact(2, { first_name: 'Sam', display: 'Sam Example', email: '1000001@os.code', phone: '' }),
  ];

  it('matches exact email, punctuated phone, full name, and a name prefix', async () => {
    const email = await search('search_contacts', [page], { query: 'pat@example.test' });
    expect(email.payload.matches[0]?.match).toEqual({ field: 'email', type: 'exact' });
    expect(email.paths).toEqual(['orgs/1/contacts/?page=1&limit=100']);

    const phone = await search('search_contacts', [page], { query: '(202) 555-0100' });
    expect(phone.payload.matches.map((row) => row.id)).toEqual([1]);
    expect(phone.payload.matches[0]?.match).toEqual({ field: 'phone', type: 'exact' });

    const name = await search('search_contacts', [page], { query: 'Pat Example' });
    expect(name.payload.matches[0]?.match).toEqual({ field: 'full_name', type: 'exact' });

    const prefix = await search('search_contacts', [page], { query: 'Pa' });
    expect(prefix.payload.matches[0]?.match).toEqual({ field: 'full_name', type: 'prefix' });
  });

  it('returns both people who share a name', async () => {
    const shared = [
      contact(1, { email: 'one@example.test' }),
      contact(2, { email: 'two@example.test' }),
    ];
    const { payload } = await search('search_contacts', [shared], { query: 'Pat Example' });
    expect(payload.matches.map((row) => row.id)).toEqual([1, 2]);
  });

  it('reports an exhausted list when nothing matches a short page', async () => {
    const { payload } = await search('search_contacts', [page], { query: 'Nobody' });
    expect(payload.matches).toEqual([]);
    expect(payload.search).toMatchObject({
      complete: true,
      results_truncated: false,
      stopped_by: 'end',
    });
  });

  it('reports max_pages when the last page is full and nothing matched', async () => {
    const full = Array.from({ length: 100 }, (_, index) => contact(index + 1, {}));
    const { payload } = await search('search_contacts', [full], {
      query: 'Zebra',
      max_pages: 1,
    });
    expect(payload.search).toMatchObject({
      complete: false,
      results_truncated: false,
      stopped_by: 'max_pages',
      pages_scanned: 1,
    });
  });

  it('keeps a short page complete when matches are truncated', async () => {
    const many = [contact(1, {}), contact(2, { email: 'two@example.test' }), contact(3, {})];
    const { payload } = await search('search_contacts', [many], {
      query: 'Pat Example',
      max_results: 1,
    });
    expect(payload.matches).toHaveLength(1);
    expect(payload.search).toMatchObject({
      complete: true,
      results_truncated: true,
      stopped_by: 'max_results',
    });
  });

  it('keeps the synthetic email flag after a local match', async () => {
    const { payload } = await search('search_contacts', [page], { query: '1000001@os.code' });
    expect(payload.matches[0]).toMatchObject({
      id: 2,
      is_synthetic_email: true,
      match: { field: 'email', type: 'exact' },
    });
  });
});

describe('search_projects', () => {
  it('matches title and address from the list and does not call get_project', async () => {
    const list = loadOpenSolarFixture('projects', 'list') as unknown[];
    const { payload, paths } = await search('search_projects', [list], {
      query: '12 Example Street',
    });
    expect(paths).toEqual(['orgs/1/projects/?page=1&limit=100']);
    expect(paths.some((path) => path.includes('/projects/1001'))).toBe(false);
    expect(payload.matches[0]).toMatchObject({
      id: 1001,
      match: { field: 'address', type: 'exact' },
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('PTEST123456');
    expect(serialized).not.toContain('passport_number');
  });

  it('matches an embedded contact email on the list row', async () => {
    const row = {
      id: 1002,
      title: 'Other',
      address: '9 Other Road',
      stage: 0,
      contacts_data: [
        { id: 1, display: 'Pat Example', email: 'pat@example.test', phone: '2025550100' },
      ],
    };
    const { payload, paths } = await search('search_projects', [[row]], {
      query: 'pat@example.test',
    });
    expect(paths).toEqual(['orgs/1/projects/?page=1&limit=100']);
    expect(payload.matches[0]?.match).toEqual({ field: 'contact_email', type: 'exact' });
    expect(payload.matches[0]).not.toHaveProperty('contacts_data');
  });
});
