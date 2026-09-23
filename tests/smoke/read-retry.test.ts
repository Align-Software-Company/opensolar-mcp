import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createClient,
  MAX_GET_ATTEMPTS,
  OpenSolarApiError,
  READ_RETRY_BASE_DELAY_MS,
} from '../../src/client/index.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

const testAuth = {
  token: 'test-token',
  baseUrl: 'https://api.opensolar.com/api/',
};

function jsonResponse(status: number, body: unknown, retryAfter?: string): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (retryAfter !== undefined) {
    headers.set('Retry-After', retryAfter);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function clientWith(fetchMock: ReturnType<typeof vi.fn>, waits: number[]) {
  vi.stubGlobal('fetch', fetchMock);
  return createClient(testAuth, {
    sleep: async (ms) => {
      waits.push(ms);
    },
  });
}

describe('JSON GET 429 retry', () => {
  it('retries a throttled GET and returns the later success', async () => {
    const waits: number[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { detail: 'throttled' }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 1 }));
    const client = clientWith(fetchMock, waits);

    await expect(client.get('orgs/1/')).resolves.toEqual({ id: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(waits).toEqual([READ_RETRY_BASE_DELAY_MS]);
  });

  it('stops after the bounded number of GET attempts', async () => {
    const waits: number[] = [];
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(jsonResponse(429, { detail: 'throttled' })));
    const client = clientWith(fetchMock, waits);

    await expect(client.get('orgs/1/')).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(MAX_GET_ATTEMPTS);
    expect(waits).toEqual([READ_RETRY_BASE_DELAY_MS, READ_RETRY_BASE_DELAY_MS * 2]);
  });

  it('waits for a Retry-After that is inside the bound', async () => {
    const waits: number[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { detail: 'throttled' }, '1'))
      .mockResolvedValueOnce(jsonResponse(200, { id: 1 }));
    const client = clientWith(fetchMock, waits);

    await expect(client.get('orgs/1/')).resolves.toEqual({ id: 1 });
    expect(waits).toEqual([1_000]);
  });

  it('returns 429 when Retry-After is longer than the bound', async () => {
    const waits: number[] = [];
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(jsonResponse(429, { detail: 'throttled' }, '120')));
    const client = clientWith(fetchMock, waits);

    await expect(client.get('orgs/1/')).rejects.toBeInstanceOf(OpenSolarApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(waits).toEqual([]);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)('does not retry %s', async (method) => {
    const waits: number[] = [];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(429, { detail: 'throttled' }));
    const client = clientWith(fetchMock, waits);
    const call =
      method === 'DELETE'
        ? client.delete('orgs/1/contacts/2')
        : client[method.toLowerCase() as 'post' | 'put' | 'patch']('orgs/1/contacts/2', {
            phone: '1',
          });

    await expect(call).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(waits).toEqual([]);
  });

  it('does not retry getFile', async () => {
    const waits: number[] = [];
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response(null, { status: 429 })));
    const client = clientWith(fetchMock, waits);

    await expect(client.getFile('orgs/1/projects/2/systems/3/image/')).rejects.toMatchObject({
      status: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(waits).toEqual([]);
  });
});
