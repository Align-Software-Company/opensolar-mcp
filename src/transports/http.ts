import { serve } from '@hono/node-server';
import { hostHeaderValidation, originValidation } from '@modelcontextprotocol/hono';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { resolveToken } from '../client/auth.js';
import { createClient } from '../client/index.js';
import {
  ConfigError,
  type HttpBind,
  isLoopbackHttpHost,
  LOOPBACK_ALLOWED_HOSTNAMES,
  loadBaseUrl,
  loadOrgId,
  loadToolFilters,
  loadUploadRoot,
} from '../lib/config.js';
import { log } from '../lib/log.js';
import { buildServer } from '../server.js';

/** Largest MCP request body accepted before authentication. */
export const MAX_HTTP_BODY_BYTES = 4 * 1024 * 1024;

function effectiveAllowlists(bind: HttpBind): { hosts: string[]; origins: string[] } {
  if (isLoopbackHttpHost(bind.host)) {
    return {
      hosts: bind.allowedHosts ?? [...LOOPBACK_ALLOWED_HOSTNAMES],
      origins: bind.allowedOrigins ?? [...LOOPBACK_ALLOWED_HOSTNAMES],
    };
  }
  if (bind.allowedHosts === undefined || bind.allowedHosts.length === 0) {
    throw new ConfigError(
      `Binding HTTP to ${bind.host} requires MCP_HTTP_ALLOWED_HOSTS so DNS-rebinding protection can allow your public hostname.`,
    );
  }
  return { hosts: bind.allowedHosts, origins: bind.allowedOrigins ?? bind.allowedHosts };
}

export function createHttpApp(bind: HttpBind): Hono {
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

  const allowlists = effectiveAllowlists(bind);
  const app = new Hono();

  // Liveness and readiness carry no data, so they sit outside the Host/Origin checks.
  // That keeps container health checks working with any MCP_HTTP_ALLOWED_HOSTS.
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.get('/ready', (c) => c.json({ status: 'ready' }));

  app.use(bind.path, hostHeaderValidation(allowlists.hosts));
  app.use(bind.path, originValidation(allowlists.origins));
  app.use(
    bind.path,
    bodyLimit({
      maxSize: MAX_HTTP_BODY_BYTES,
      onError: (c) =>
        c.json(
          { jsonrpc: '2.0', error: { code: -32000, message: 'Request body too large' }, id: null },
          413,
        ),
    }),
  );
  app.all(bind.path, async (c) => {
    try {
      resolveToken({
        header: c.req.raw.headers.get('authorization'),
        envToken,
        allowEnvFallback,
      });
    } catch (error) {
      if (error instanceof ConfigError) {
        c.header('WWW-Authenticate', 'Bearer');
        return c.json({ error: 'Unauthorized' }, 401);
      }
      throw error;
    }
    return handler.fetch(c.req.raw);
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
