import { describe, expect, it } from 'vitest';
import { resolveToken, tokenFromAuthorizationHeader } from '../../src/client/auth.js';
import { ConfigError } from '../../src/lib/config-error.js';

describe('OpenSolar bearer auth', () => {
  it('accepts an exact Bearer token', () => {
    expect(tokenFromAuthorizationHeader('Bearer token-123')).toBe('token-123');
    expect(tokenFromAuthorizationHeader('bearer\ttoken-123')).toBe('token-123');
  });

  it('rejects malformed or trailing Authorization values', () => {
    expect(tokenFromAuthorizationHeader('Basic token-123')).toBeUndefined();
    expect(tokenFromAuthorizationHeader('Bearer token-123 extra')).toBeUndefined();
    expect(tokenFromAuthorizationHeader('Bearer')).toBeUndefined();
  });

  it('prefers an explicit request token over the environment token', () => {
    expect(
      resolveToken({
        header: 'Bearer request-token',
        envToken: 'env-token',
        allowEnvFallback: true,
      }),
    ).toBe('request-token');
  });

  it('does not fall back to the environment when a malformed header was supplied', () => {
    expect(() =>
      resolveToken({
        header: 'Bearer request-token extra',
        envToken: 'env-token',
        allowEnvFallback: true,
      }),
    ).toThrow(ConfigError);
  });

  it('allows the environment fallback only when explicitly enabled', () => {
    expect(
      resolveToken({
        header: undefined,
        envToken: '  env-token  ',
        allowEnvFallback: true,
      }),
    ).toBe('env-token');

    expect(() =>
      resolveToken({
        header: undefined,
        envToken: 'env-token',
        allowEnvFallback: false,
      }),
    ).toThrow(/Non-loopback HTTP requires Authorization/);
  });

  it('rejects a whitespace-only environment token', () => {
    expect(() =>
      resolveToken({
        header: undefined,
        envToken: '   ',
        allowEnvFallback: true,
      }),
    ).toThrow(/token missing/i);
  });
});
