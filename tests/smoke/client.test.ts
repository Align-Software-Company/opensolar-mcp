import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient, OpenSolarApiError } from '../../src/client/index.js';
import { loadOpenSolarFixture } from '../fixtures/load-fixture.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const testConfig = {
  OPENSOLAR_API_TOKEN: 'test-token',
  OPENSOLAR_ORG_ID: 1,
  BASE_URL: 'https://api.opensolar.com/api/',
};

describe('OpenSolar client', () => {
  it('loads sanitized OpenSolar fixtures without a live token', () => {
    const projects = loadOpenSolarFixture('projects', 'list');
    expect(Array.isArray(projects)).toBe(true);
    expect(projects).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 1001, address: '12 Example Street' })]),
    );
  });

  it('GETs against the configured base URL with a bearer token', async () => {
    const payload = loadOpenSolarFixture('org', 'summary');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createClient(testConfig);
    const body = await client.get('orgs/1/');

    expect(body).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://api.opensolar.com/api/orgs/1/');
    expect(init).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          Accept: 'application/json',
        }),
      }),
    );
  });

  it('throws OpenSolarApiError on a non-OK response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('denied', { status: 401, statusText: 'Unauthorized' }));
    vi.stubGlobal('fetch', fetchMock);

    const client = createClient(testConfig);
    const error = await client.get('orgs/1/').catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(OpenSolarApiError);
    expect(error).toMatchObject({ status: 401, body: 'denied' });
  });
});
