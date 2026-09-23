import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, loadUploadRoot } from '../../src/lib/config.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('loadConfig', () => {
  it('throws when the API token is missing', () => {
    vi.stubEnv('OPENSOLAR_API_TOKEN', '');
    vi.stubEnv('OPENSOLAR_ORG_ID', '1');

    expect(() => loadConfig()).toThrow(/OPENSOLAR_API_TOKEN/);
  });

  it('throws when the API token is only whitespace', () => {
    vi.stubEnv('OPENSOLAR_API_TOKEN', '   ');
    vi.stubEnv('OPENSOLAR_ORG_ID', '1');

    expect(() => loadConfig()).toThrow(/OPENSOLAR_API_TOKEN/);
  });

  it('throws when the org id is not a positive integer', () => {
    vi.stubEnv('OPENSOLAR_API_TOKEN', 'test-token');
    vi.stubEnv('OPENSOLAR_ORG_ID', '0');

    expect(() => loadConfig()).toThrow(/OPENSOLAR_ORG_ID/);
  });

  it('loads token, org id, and default base URL', () => {
    vi.stubEnv('OPENSOLAR_API_TOKEN', 'test-token');
    vi.stubEnv('OPENSOLAR_ORG_ID', '42');
    vi.stubEnv('OPENSOLAR_BASE_URL', 'https://api.opensolar.com/api/');

    const config = loadConfig();
    expect(config.OPENSOLAR_API_TOKEN).toBe('test-token');
    expect(config.OPENSOLAR_ORG_ID).toBe(42);
    expect(config.BASE_URL).toBe('https://api.opensolar.com/api/');
  });

  it('loads and trims an optional upload root', () => {
    expect(loadUploadRoot({ OPENSOLAR_UPLOAD_ROOT: '  /tmp/uploads  ' })).toBe('/tmp/uploads');
    expect(loadUploadRoot({ OPENSOLAR_UPLOAD_ROOT: '   ' })).toBeUndefined();
    expect(loadUploadRoot({})).toBeUndefined();
  });

  it('appends a trailing slash to a custom HTTPS base URL', () => {
    vi.stubEnv('OPENSOLAR_API_TOKEN', 'test-token');
    vi.stubEnv('OPENSOLAR_ORG_ID', '42');
    vi.stubEnv('OPENSOLAR_BASE_URL', 'https://api.example.test/api');

    expect(loadConfig().BASE_URL).toBe('https://api.example.test/api/');
  });

  it('allows HTTP only for loopback development endpoints', () => {
    vi.stubEnv('OPENSOLAR_API_TOKEN', 'test-token');
    vi.stubEnv('OPENSOLAR_ORG_ID', '42');
    vi.stubEnv('OPENSOLAR_BASE_URL', 'http://127.0.0.1:9000/api');

    expect(loadConfig().BASE_URL).toBe('http://127.0.0.1:9000/api/');

    vi.stubEnv('OPENSOLAR_BASE_URL', 'http://api.example.test/api');
    expect(() => loadConfig()).toThrow(/HTTPS/);
  });

  it('rejects credentials, query parameters, and fragments in the API base URL', () => {
    vi.stubEnv('OPENSOLAR_API_TOKEN', 'test-token');
    vi.stubEnv('OPENSOLAR_ORG_ID', '42');

    vi.stubEnv('OPENSOLAR_BASE_URL', 'https://user:pass@api.example.test/api/');
    expect(() => loadConfig()).toThrow(/credentials/);

    vi.stubEnv('OPENSOLAR_BASE_URL', 'https://api.example.test/api/?tenant=1');
    expect(() => loadConfig()).toThrow(/query or hash/);

    vi.stubEnv('OPENSOLAR_BASE_URL', 'https://api.example.test/api/#fragment');
    expect(() => loadConfig()).toThrow(/query or hash/);
  });
});
