import { describe, expect, it } from 'vitest';
import { EnrichedContactSchema, ListContactsOutputSchema } from '../../src/schemas/contact.js';
import { GetEventOutputSchema } from '../../src/schemas/event.js';
import { GetOrgOutputSchema } from '../../src/schemas/org.js';
import { buildServer } from '../../src/server.js';
import { loadOpenSolarFixture } from '../fixtures/load-fixture.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

describe('tool structured output', () => {
  it('returns curated get_org structuredContent', async () => {
    const mcp = buildServer({
      client: testClient(async () => loadOpenSolarFixture('org', 'summary')),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });
    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'get_org', arguments: {} }),
    );
    const payload = requireStructuredContent(result);
    expect(GetOrgOutputSchema.parse(payload)).toEqual(
      expect.objectContaining({ id: 1, name: 'Example Solar Co' }),
    );
    const text = result.content[0];
    if (text?.type !== 'text') {
      throw new Error('expected text content');
    }
    expect(text.text).toBe('Org 1: Example Solar Co.');
    expect(text.text.startsWith('{')).toBe(false);
  });

  it('returns enriched list_contacts and get_contact', async () => {
    const contacts = loadOpenSolarFixture('contacts', 'list');
    if (!Array.isArray(contacts)) {
      throw new Error('contacts fixture must be an array');
    }
    const synthetic = contacts.find((row) => {
      return row !== null && typeof row === 'object' && 'id' in row && row.id === 3002;
    });
    if (synthetic === undefined) {
      throw new Error('contacts fixture is missing id 3002');
    }
    const mcp = buildServer({
      client: testClient(async (path: string) =>
        path.includes('/contacts/3002') ? synthetic : contacts,
      ),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const listed = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'list_contacts', arguments: {} }),
    );
    const listPayload = requireStructuredContent(listed);
    expect(ListContactsOutputSchema.parse(listPayload)).toEqual(
      expect.objectContaining({
        contacts: expect.arrayContaining([
          expect.objectContaining({ id: 3001, is_synthetic_email: false }),
          expect.objectContaining({ id: 3002, email: '1000001@os.code', is_synthetic_email: true }),
        ]),
      }),
    );

    const detail = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'get_contact', arguments: { contact_id: 3002 } }),
    );
    const contact = requireStructuredContent(detail);
    expect(EnrichedContactSchema.parse(contact)).toEqual(
      expect.objectContaining({ id: 3002, is_synthetic_email: true }),
    );
  });

  it('returns get_event with event_type_name and without url or org', async () => {
    const mcp = buildServer({
      client: testClient(async () => loadOpenSolarFixture('events', 'detail')),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });
    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'get_event', arguments: { event_id: 8001 } }),
    );
    const payload = requireStructuredContent(result);
    expect(GetEventOutputSchema.parse(payload)).toEqual(
      expect.objectContaining({
        id: 8001,
        event_type_id: 56,
        event_type_name: 'Project Stage Changed',
      }),
    );
    expect(payload).not.toHaveProperty('url');
    expect(payload).not.toHaveProperty('org');
  });
});
