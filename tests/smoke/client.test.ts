import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient, DEFAULT_TIMEOUT_MS, OpenSolarApiError } from '../../src/client/index.js';
import { loadOpenSolarFixture } from '../fixtures/load-fixture.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const testAuth = {
  token: 'test-token',
  baseUrl: 'https://api.opensolar.com/api/',
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
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');

    const client = createClient(testAuth);
    const body = await client.get('orgs/1/');

    expect(body).toEqual(payload);
    expect(timeoutSpy).toHaveBeenCalledWith(DEFAULT_TIMEOUT_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://api.opensolar.com/api/orgs/1/');
    expect(init).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          Accept: 'application/json',
        }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('throws OpenSolarApiError on a non-OK response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('denied', { status: 401, statusText: 'Unauthorized' }));
    vi.stubGlobal('fetch', fetchMock);

    const client = createClient(testAuth);
    const error = await client.get('orgs/1/').catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(OpenSolarApiError);
    expect(error).toMatchObject({ status: 401, body: 'denied' });
  });

  it('throws a 504 OpenSolarApiError when a hung request times out', async () => {
    const timeoutMs = 20;
    const fetchMock = vi.fn((_url: unknown, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal == null) {
          return;
        }
        const abort = () => {
          const reason = signal.reason;
          reject(
            reason instanceof DOMException
              ? reason
              : new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
          );
        };
        if (signal.aborted) {
          abort();
          return;
        }
        signal.addEventListener('abort', abort, { once: true });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createClient(testAuth);
    const error = await client.get('orgs/1/', { timeoutMs }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(OpenSolarApiError);
    expect(error).toMatchObject({
      status: 504,
      body: '',
      message: `OpenSolar API timed out after ${timeoutMs}ms on GET orgs/1/`,
    });
  });
});
