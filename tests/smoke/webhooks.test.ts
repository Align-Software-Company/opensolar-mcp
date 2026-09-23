import { describe, expect, it } from 'vitest';
import {
  CuratedWebhookSchema,
  ListWebhookLogsOutputSchema,
  ListWebhookQueueOutputSchema,
  ListWebhooksOutputSchema,
} from '../../src/schemas/webhook.js';
import { buildServer } from '../../src/server.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

const secretHeader = '{"Authorization":"Token SECRET-SHOULD-NOT-LEAK"}';

const webhookRecord = {
  id: 7,
  endpoint: 'https://example.test/hooks',
  enabled: true,
  debug: false,
  trigger_fields: ['project.stage'],
  payload_fields: ['project.id'],
  headers: secretHeader,
};

describe('list_webhooks', () => {
  it('returns the curated webhook and omits headers', async () => {
    const calls: string[] = [];
    const client = testClient(async (path) => {
      calls.push(path);
      return [webhookRecord];
    });
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'list_webhooks', arguments: {} }),
    );
    const payload = ListWebhooksOutputSchema.parse(requireStructuredContent(result));

    expect(calls).toEqual(['orgs/1/webhooks/']);
    expect(payload.webhooks).toEqual([
      {
        id: 7,
        endpoint: 'https://example.test/hooks',
        enabled: true,
        debug: false,
        trigger_fields: ['project.stage'],
        payload_fields: ['project.id'],
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('SECRET-SHOULD-NOT-LEAK');
  });
});

describe('create_webhook', () => {
  it('posts endpoint, enabled, and debug, and omits unset field lists', async () => {
    const posts: Array<{ path: string; body: unknown }> = [];
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.post = async (path, body) => {
      posts.push({ path, body });
      return webhookRecord;
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'create_webhook',
        arguments: {
          endpoint: 'https://example.test/hooks',
          enabled: true,
          debug: false,
        },
      }),
    );
    const payload = CuratedWebhookSchema.parse(requireStructuredContent(result));

    expect(posts).toEqual([
      {
        path: 'orgs/1/webhooks/',
        body: {
          endpoint: 'https://example.test/hooks',
          enabled: true,
          debug: false,
        },
      },
    ]);
    expect(payload.id).toBe(7);
    expect(JSON.stringify(result)).not.toContain('SECRET-SHOULD-NOT-LEAK');
  });

  it('sends the field lists when they are set', async () => {
    const posts: Array<{ path: string; body: unknown }> = [];
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.post = async (path, body) => {
      posts.push({ path, body });
      return webhookRecord;
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'create_webhook',
        arguments: {
          endpoint: 'https://example.test/hooks',
          enabled: true,
          debug: false,
          trigger_fields: ['project.contract_date'],
          payload_fields: ['project.*'],
        },
      }),
    );

    expect(posts[0]?.body).toEqual({
      endpoint: 'https://example.test/hooks',
      enabled: true,
      debug: false,
      trigger_fields: ['project.contract_date'],
      payload_fields: ['project.*'],
    });
  });

  it('rejects headers and an undocumented field path before HTTP', async () => {
    const posts: string[] = [];
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.post = async (path) => {
      posts.push(path);
      return webhookRecord;
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const headers = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'create_webhook',
        arguments: {
          endpoint: 'https://example.test/hooks',
          enabled: true,
          debug: false,
          headers: secretHeader,
        },
      }),
    );
    const unknownPath = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'create_webhook',
        arguments: {
          endpoint: 'https://example.test/hooks',
          enabled: true,
          debug: false,
          trigger_fields: ['project.not_a_documented_path'],
        },
      }),
    );

    expect(headers.isError).toBe(true);
    expect(unknownPath.isError).toBe(true);
    expect(posts).toEqual([]);
    expect(JSON.stringify(headers)).not.toContain('SECRET-SHOULD-NOT-LEAK');
  });
});

describe('update_webhook', () => {
  it('patches only the fields that were set', async () => {
    const patches: Array<{ path: string; body: unknown }> = [];
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.patch = async (path, body) => {
      patches.push({ path, body });
      return webhookRecord;
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'update_webhook',
        arguments: {
          id: 7,
          enabled: false,
          trigger_fields: ['project.installation_date'],
          payload_fields: ['project.*'],
        },
      }),
    );

    expect(patches).toEqual([
      {
        path: 'orgs/1/webhooks/7/',
        body: {
          enabled: false,
          trigger_fields: ['project.installation_date'],
          payload_fields: ['project.*'],
        },
      },
    ]);
    expect(CuratedWebhookSchema.parse(requireStructuredContent(result)).id).toBe(7);
    expect(JSON.stringify(result)).not.toContain('SECRET-SHOULD-NOT-LEAK');
  });

  it('rejects an update that only has an id', async () => {
    const patches: string[] = [];
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.patch = async (path) => {
      patches.push(path);
      return webhookRecord;
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'update_webhook', arguments: { id: 7 } }),
    );

    expect(result.isError).toBe(true);
    expect(patches).toEqual([]);
  });
});

describe('list_webhook_logs', () => {
  it('requests one page and omits the delivery notes', async () => {
    const calls: string[] = [];
    const client = testClient(async (path) => {
      calls.push(path);
      return [
        {
          url: 'https://api.opensolar.com/api/orgs/1/webhook_process_logs/347/',
          webhook: 'https://api.opensolar.com/api/orgs/1/webhooks/123/',
          created_date: '2024-12-01T23:42:49.465397Z',
          modified_date: '2024-12-01T23:42:49.465444Z',
          successful: true,
          model_name: 'Project',
          model_pk: 123123,
          event_queue_name: 'WebhookQueueModel',
          event_id: 123123,
          event_name: 'UPDATE',
          event_timestamp: '2024-12-01T23:42:49.464822Z',
          notes: 'BODY-SHOULD-NOT-LEAK',
          id: 56573654,
        },
      ];
    });
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'list_webhook_logs',
        arguments: { search: 'Project' },
      }),
    );
    const payload = ListWebhookLogsOutputSchema.parse(requireStructuredContent(result));

    expect(calls).toEqual(['orgs/1/webhook_process_logs/?page=1&limit=20&search=Project']);
    expect(payload.webhook_logs).toEqual([
      {
        id: 56573654,
        webhook_id: 123,
        event_queue_name: 'WebhookQueueModel',
        created_date: '2024-12-01T23:42:49.465397Z',
        modified_date: '2024-12-01T23:42:49.465444Z',
        event_timestamp: '2024-12-01T23:42:49.464822Z',
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('BODY-SHOULD-NOT-LEAK');
    expect(JSON.stringify(result)).not.toContain('model_pk');
  });
});

describe('list_webhook_queue', () => {
  it('requests one page and returns the documented queue fields', async () => {
    const calls: string[] = [];
    const client = testClient(async (path) => {
      calls.push(path);
      return [
        {
          url: 'https://api.opensolar.com/api/orgs/1/webhook_queue_models/234/',
          webhook: 'https://api.opensolar.com/api/orgs/1/webhooks/132/',
          number_of_attempts: 1,
          next_attempt_at: '2024-12-02T05:36:47.049268Z',
          processing_started_at: '2024-12-02T05:37:11.482920Z',
          model_name: 'Project',
          model_pk: 1237777,
          event: 'UPDATE',
          foreign_identifier: '4cd18772-b98e-4ea9-91b5-612cf8374711',
          id: 38815749,
        },
      ];
    });
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'list_webhook_queue', arguments: {} }),
    );
    const payload = ListWebhookQueueOutputSchema.parse(requireStructuredContent(result));

    expect(calls).toEqual(['orgs/1/webhook_queue_models/?page=1&limit=20']);
    expect(payload.webhook_queue).toEqual([
      {
        id: 38815749,
        webhook_id: 132,
        model_name: 'Project',
        event: 'UPDATE',
        number_of_attempts: 1,
        next_attempt_at: '2024-12-02T05:36:47.049268Z',
        processing_started_at: '2024-12-02T05:37:11.482920Z',
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('foreign_identifier');
    expect(JSON.stringify(result)).not.toContain('1237777');
  });
});
