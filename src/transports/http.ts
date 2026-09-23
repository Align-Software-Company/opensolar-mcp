import { serve } from '@hono/node-server';
import { createMcpHonoApp } from '@modelcontextprotocol/hono';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { resolveToken } from '../client/auth.js';
import { createClient } from '../client/index.js';
import {
  type HttpBind,
  isLoopbackHttpHost,
  loadBaseUrl,
  loadOrgId,
  loadToolFilters,
  loadUploadRoot,
} from '../lib/config.js';
import { log } from '../lib/log.js';
import { buildServer } from '../server.js';

export function createHttpApp(bind: HttpBind): ReturnType<typeof createMcpHonoApp> {
  const orgId = loadOrgId();
  const baseUrl = loadBaseUrl();
  const envToken = process.env.OPENSOLAR_API_TOKEN;
  const allowEnvFallback = isLoopbackHttpHost(bind.host);
  const filters = loadToolFilters();
  const uploadRoot = loadUploadRoot();

  const handler = createMcpHandler((factoryCtx) => {
    const token = resolveToken({
      header: factoryCtx.requestInfo?.headers.get('authorization'),
      envToken,
      allowEnvFallback,
    });
    const client = createClient({ token, baseUrl });
    return buildServer({ client, orgId, filters, uploadRoot });
  });

  const app = createMcpHonoApp({
    host: bind.host,
    ...(bind.allowedHosts === undefined ? {} : { allowedHosts: bind.allowedHosts }),
  });

  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.get('/ready', (c) => c.json({ status: 'ready' }));
  app.all(bind.path, (c) => {
    const parsedBody: unknown = c.get('parsedBody' as never);
    return handler.fetch(c.req.raw, { parsedBody });
  });

  return app;
}

export function serveHttp(bind: HttpBind): void {
  if (!isLoopbackHttpHost(bind.host) && (process.env.OPENSOLAR_API_TOKEN?.trim() ?? '') !== '') {
    log.warn(
      'OPENSOLAR_API_TOKEN is ignored for non-loopback HTTP; send Authorization: Bearer <token> on each MCP request',
    );
  }
  const app = createHttpApp(bind);
  serve({ fetch: app.fetch, hostname: bind.host, port: bind.port });
  log.info('opensolar-mcp ready', {
    transport: 'http',
    host: bind.host,
    port: bind.port,
    path: bind.path,
  });
}
