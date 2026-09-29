import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_DOWNLOAD_REDIRECTS } from '../../src/client/download-target.js';
import { createClient, DEFAULT_TIMEOUT_MS, OpenSolarApiError } from '../../src/client/index.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const testAuth = {
  token: 'test-token',
  baseUrl: 'https://api.opensolar.com/api/',
};

const imagePath = 'orgs/1/projects/2/systems/3/image/?width=500&height=500';
const apiUrl = `https://api.opensolar.com/api/${imagePath}`;

function redirectTo(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location } });
}

function imageResponse(): Response {
  return new Response(Uint8Array.from([1, 2, 3]), {
    status: 200,
    headers: { 'Content-Type': 'image/png' },
  });
}

function clientWithLookup(lookupHost: (hostname: string) => Promise<readonly string[]>) {
  return createClient(testAuth, { lookupHost });
}

function publicClient() {
  return clientWithLookup(async () => ['1.1.1.1']);
}

function requestInit(fetchMock: ReturnType<typeof vi.fn>, call: number): RequestInit {
  return fetchMock.mock.calls[call]?.[1] as RequestInit;
}

describe('system image redirects', () => {
  it('follows a public https redirect without the API token', async () => {
    const nextUrl = 'https://cdn.example.test/system.png';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectTo(nextUrl))
      .mockResolvedValueOnce(imageResponse());
    vi.stubGlobal('fetch', fetchMock);
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');

    const file = await publicClient().getFile(imagePath, { readBody: true });

    expect(file).toEqual({
      contentType: 'image/png',
      privateFileId: null,
      bytes: Uint8Array.from([1, 2, 3]),
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(apiUrl);
    expect(requestInit(fetchMock, 0).headers).toEqual({ Authorization: 'Bearer test-token' });
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(nextUrl);
    expect(requestInit(fetchMock, 1).redirect).toBe('manual');
    expect(requestInit(fetchMock, 1).headers).toBeUndefined();
    expect(requestInit(fetchMock, 0).signal).toBe(requestInit(fetchMock, 1).signal);
    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).toHaveBeenCalledWith(DEFAULT_TIMEOUT_MS);
  });

  it.each([
    'http://cdn.example.test/x',
    'https://10.0.0.5/x',
    'https://user:pass@cdn.example.test/x',
  ])('refuses %s and does not fetch it', async (location) => {
    const fetchMock = vi.fn().mockResolvedValue(redirectTo(location));
    vi.stubGlobal('fetch', fetchMock);

    const error = await publicClient()
      .getFile(imagePath)
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(OpenSolarApiError);
    expect(error).toMatchObject({ status: 400, body: '' });
    expect(String(error)).not.toContain(location);
    expect(String(error)).not.toContain(testAuth.token);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(apiUrl);
  });

  it('refuses a redirect whose hostname resolves to a loopback address', async () => {
    const location = 'https://metadata.example.test/latest';
    const fetchMock = vi.fn().mockResolvedValue(redirectTo(location));
    vi.stubGlobal('fetch', fetchMock);
    const client = clientWithLookup(async (hostname) =>
      hostname === 'metadata.example.test' ? ['127.0.0.1'] : ['1.1.1.1'],
    );

    const error = await client.getFile(imagePath).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(OpenSolarApiError);
    expect(error).toMatchObject({ status: 400, body: '' });
    expect(String(error)).not.toContain(location);
    expect(String(error)).not.toContain('127.0.0.1');
    expect(String(error)).not.toContain(testAuth.token);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the API token on a same-origin redirect', async () => {
    const nextUrl = 'https://api.opensolar.com/api/orgs/1/private_files/9/';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectTo(nextUrl))
      .mockResolvedValueOnce(imageResponse());
    vi.stubGlobal('fetch', fetchMock);
    const client = clientWithLookup(async () => {
      throw new Error('same-origin redirect must not look up a host');
    });

    await client.getFile(imagePath, { readBody: true });

    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(nextUrl);
    expect(requestInit(fetchMock, 1).headers).toEqual({ Authorization: 'Bearer test-token' });
  });

  it('drops the API token after leaving the API origin, including a hop back', async () => {
    const cdnUrl = 'https://cdn.example.test/img.png';
    const backUrl = 'https://api.opensolar.com/api/orgs/1/private_files/9/';
    const lookedUp: string[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectTo(cdnUrl))
      .mockResolvedValueOnce(redirectTo(backUrl))
      .mockResolvedValueOnce(imageResponse());
    vi.stubGlobal('fetch', fetchMock);
    const client = clientWithLookup(async (hostname) => {
      lookedUp.push(hostname);
      return ['1.1.1.1'];
    });

    await client.getFile(imagePath, { readBody: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(cdnUrl);
    expect(requestInit(fetchMock, 1).headers).toBeUndefined();
    expect(String(fetchMock.mock.calls[2]?.[0])).toBe(backUrl);
    expect(requestInit(fetchMock, 2).headers).toBeUndefined();
    expect(lookedUp).toEqual(['cdn.example.test']);
  });

  it('refuses more than the redirect cap', async () => {
    const location = 'https://cdn.example.test/hop';
    const fetchMock = vi.fn().mockResolvedValue(redirectTo(location));
    vi.stubGlobal('fetch', fetchMock);

    const error = await publicClient()
      .getFile(imagePath)
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(OpenSolarApiError);
    expect(error).toMatchObject({ status: 400, body: '' });
    expect(String(error)).not.toContain(location);
    expect(String(error)).not.toContain(testAuth.token);
    expect(fetchMock).toHaveBeenCalledTimes(MAX_DOWNLOAD_REDIRECTS + 1);
  });

  it('returns a private file id found in a redirect Location', async () => {
    const location =
      'https://cdn.example.test/orgs/1/private_files/44/?Expires=1&Signature=fixture';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectTo(location))
      .mockResolvedValueOnce(redirectTo('https://cdn.example.test/image.png'))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const file = await publicClient().getFile(imagePath);

    expect(file.privateFileId).toBe(44);
    expect(file.bytes).toBeNull();
    expect(JSON.stringify(file)).not.toContain(location);
    expect(JSON.stringify(file)).not.toContain('Signature');
    expect(JSON.stringify(file)).not.toContain(testAuth.token);
  });
});
