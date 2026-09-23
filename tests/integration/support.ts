import type { OpenSolarClient } from '../../src/client/index.js';
import { createClient } from '../../src/client/index.js';
import { loadConfig } from '../../src/lib/config.js';
import { buildServer } from '../../src/server.js';
import { ALL_TOOL_FILTERS, requireStructuredContent, withMcpClient } from '../helpers/mcp.js';
import { hasLiveOpenSolarCredentials, loadLocalEnv } from '../load-local-env.js';

loadLocalEnv();

export const liveReads = hasLiveOpenSolarCredentials();

export const liveWrites = liveReads && process.env.OPENSOLAR_INTEGRATION_WRITES === '1';

export function liveOpenSolarClient(): OpenSolarClient {
  const config = loadConfig();
  return createClient({
    token: config.OPENSOLAR_API_TOKEN,
    baseUrl: config.BASE_URL,
  });
}

export function liveOrgId(): number {
  return loadConfig().OPENSOLAR_ORG_ID;
}

export async function callLiveTool(
  client: OpenSolarClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const server = buildServer({
    client,
    orgId: liveOrgId(),
    filters: ALL_TOOL_FILTERS,
  });
  const result = await withMcpClient(server, (session) =>
    session.callTool({ name, arguments: args }),
  );
  return requireStructuredContent(result);
}

export async function callLiveToolResult(
  client: OpenSolarClient,
  name: string,
  args: Record<string, unknown>,
): Promise<{ isError?: boolean; structuredContent?: unknown; content?: unknown }> {
  const server = buildServer({
    client,
    orgId: liveOrgId(),
    filters: ALL_TOOL_FILTERS,
  });
  return withMcpClient(server, (session) => session.callTool({ name, arguments: args }));
}

export function traceClient(inner: OpenSolarClient): OpenSolarClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    get(path, options) {
      calls.push(`GET ${path}`);
      return inner.get(path, options);
    },
    post(path, body, options) {
      calls.push(`POST ${path}`);
      return inner.post(path, body, options);
    },
    postForm(path, form, options) {
      calls.push(`POST ${path}`);
      return inner.postForm(path, form, options);
    },
    put(path, body, options) {
      calls.push(`PUT ${path}`);
      return inner.put(path, body, options);
    },
    patch(path, body, options) {
      calls.push(`PATCH ${path}`);
      return inner.patch(path, body, options);
    },
    delete(path, options) {
      calls.push(`DELETE ${path}`);
      return inner.delete(path, options);
    },
    download(url, options) {
      calls.push(`DOWNLOAD ${url}`);
      return inner.download(url, options);
    },
    getFile(path, options) {
      calls.push(`GET ${path}`);
      return inner.getFile(path, options);
    },
    resourceUrl(path) {
      return inner.resourceUrl(path);
    },
  };
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('expected a JSON object');
  }
  return Object.fromEntries(Object.entries(value));
}

export function asArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error('expected a JSON array');
  }
  return value;
}

export function positiveId(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

export function textField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}
