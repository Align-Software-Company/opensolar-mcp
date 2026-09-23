import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createClient,
  DEFAULT_TIMEOUT_MS,
  MAX_PRIVATE_FILE_BYTES,
  NON_JSON_BODY_MESSAGE,
  OpenSolarApiError,
} from '../../src/client/index.js';
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

  it('uses 30s by default and the per-call override when one is passed', async () => {
    const payload = loadOpenSolarFixture('org', 'summary');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    const client = createClient(testAuth);

    await client.get('orgs/1/');
    await client.get('orgs/1/', { timeoutMs: 120_000 });

    expect(timeoutSpy.mock.calls.map((call) => call[0])).toEqual([DEFAULT_TIMEOUT_MS, 120_000]);
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

  it('does not retry a failed POST and appends a trailing slash', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('nope', { status: 500, statusText: 'Server Error' }));
    vi.stubGlobal('fetch', fetchMock);

    const client = createClient(testAuth);
    const error = await client
      .post('orgs/1/contacts', { first_name: 'Pat' })
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(OpenSolarApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://api.opensolar.com/api/orgs/1/contacts/');
    expect(init).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ first_name: 'Pat' }),
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('posts multipart without a JSON content type and does not retry', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('nope', { status: 500, statusText: 'Server Error' }));
    vi.stubGlobal('fetch', fetchMock);
    const form = new FormData();
    form.append('title', 'My Document');
    form.append('file_contents', new Blob(['hello']), 'upload.txt');

    const client = createClient(testAuth);
    const error = await client
      .postForm('orgs/1/private_files', form)
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(OpenSolarApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://api.opensolar.com/api/orgs/1/private_files/');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(form);
    expect(init?.headers).toEqual({
      Authorization: 'Bearer test-token',
      Accept: 'application/json',
    });
  });

  it('DELETE sends no body and no content type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const client = createClient(testAuth);
    await expect(client.delete('orgs/1/contacts/9')).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://api.opensolar.com/api/orgs/1/contacts/9/');
    expect(init).toEqual(
      expect.objectContaining({
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer test-token',
          Accept: 'application/json',
        },
      }),
    );
    expect(init?.body).toBeUndefined();
  });

  it('builds resource URLs from the configured base URL', () => {
    const client = createClient(testAuth);
    expect(client.resourceUrl('roof_types/6/')).toBe('https://api.opensolar.com/api/roof_types/6/');
    expect(client.resourceUrl('orgs/1/roles/4/')).toBe(
      'https://api.opensolar.com/api/orgs/1/roles/4/',
    );
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

  it('does not echo a non-JSON body', async () => {
    const secret = 'https://files.example.test/private/site.pdf?Expires=1&Signature=fixture';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(secret, { status: 200 })));
    const client = createClient(testAuth);

    const error = await client
      .get('orgs/1/projects/9/generate_document/proposal/')
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(OpenSolarApiError);
    expect(error).toMatchObject({ status: 200, body: '', message: NON_JSON_BODY_MESSAGE });
    expect(String(error)).not.toContain('Signature');
  });

  it('follows redirects for an API file and keeps the final URL off the result', async () => {
    const signed = 'https://files.example.test/private/site.png?Expires=1&Signature=fixture';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(Uint8Array.from([1, 2, 3]), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          Link: '<https://api.opensolar.com/api/orgs/1/private_files/9/>',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = createClient(testAuth);

    const file = await client.getFile(
      'orgs/1/projects/42/systems/abc-123/image/?width=500&height=500',
      { readBody: true },
    );

    expect(file).toEqual({
      contentType: 'image/png',
      privateFileId: 9,
      bytes: Uint8Array.from([1, 2, 3]),
    });
    expect(JSON.stringify(file)).not.toContain('Signature');
    expect(JSON.stringify(file)).not.toContain(signed);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.redirect).toBe('follow');
    expect(init.headers).toEqual({ Authorization: 'Bearer test-token' });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://api.opensolar.com/api/orgs/1/projects/42/systems/abc-123/image/?width=500&height=500',
    );
  });

  it('downloads a private file without the API token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"ok":true}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = createClient(testAuth);
    const url = 'https://files.example.test/private/site.json?Expires=1&Signature=fixture';

    const downloaded = await client.download(url);

    expect(new TextDecoder().decode(downloaded.bytes)).toBe('{"ok":true}');
    expect(downloaded.contentType).toBe('application/json');
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(url);
    expect(init.redirect).toBe('follow');
    expect(JSON.stringify(init.headers ?? {})).not.toContain('test-token');
  });

  it('refuses a private file download over 10 MB without echoing the URL', async () => {
    const url = 'https://files.example.test/private/site.json?Expires=1&Signature=fixture';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('x', {
          status: 200,
          headers: { 'Content-Length': String(MAX_PRIVATE_FILE_BYTES + 1) },
        }),
      ),
    );
    const client = createClient(testAuth);
    const error = await client.download(url).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(OpenSolarApiError);
    expect(error).toMatchObject({ status: 413, body: '' });
    expect(String(error)).not.toContain(url);
    expect(String(error)).not.toContain('Signature');
  });
});
