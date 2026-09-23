import { ConfigError } from '../lib/config-error.js';

const BEARER_PREFIX = /^Bearer[ \t]+(\S+)$/i;

export function tokenFromAuthorizationHeader(
  header: string | null | undefined,
): string | undefined {
  if (header === null || header === undefined || header.trim() === '') {
    return undefined;
  }
  const match = BEARER_PREFIX.exec(header.trim());
  const token = match?.[1];
  return token === undefined || token === '' ? undefined : token;
}

export function resolveToken(options: {
  header: string | null | undefined;
  envToken: string | undefined;
  allowEnvFallback: boolean;
}): string {
  const header = options.header?.trim() ?? '';
  if (header !== '') {
    const fromHeader = tokenFromAuthorizationHeader(header);
    if (fromHeader === undefined) {
      throw new ConfigError('Authorization header must be exactly Bearer <token>.');
    }
    return fromHeader;
  }

  if (options.allowEnvFallback) {
    const fromEnv = options.envToken?.trim() ?? '';
    if (fromEnv !== '') {
      return fromEnv;
    }
  }

  const message = options.allowEnvFallback
    ? 'OpenSolar API token missing. Pass Authorization: Bearer <token> or set OPENSOLAR_API_TOKEN.'
    : 'OpenSolar API token missing. Non-loopback HTTP requires Authorization: Bearer <token> on each MCP request.';
  throw new ConfigError(message);
}
