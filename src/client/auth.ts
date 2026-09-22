import { ConfigError } from '../lib/config-error.js';

const BEARER_PREFIX = /^Bearer\s+(\S+)/i;

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
}): string {
  const fromHeader = tokenFromAuthorizationHeader(options.header);
  if (fromHeader !== undefined) {
    return fromHeader;
  }
  if (options.envToken !== undefined && options.envToken !== '') {
    return options.envToken;
  }
  throw new ConfigError(
    'OpenSolar API token missing. Pass Authorization: Bearer <token> or set OPENSOLAR_API_TOKEN.',
  );
}
