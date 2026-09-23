import { privateFileIdFromText } from '../lib/private-file-id.js';

export class OpenSolarApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = 'OpenSolarApiError';
  }
}

export const DEFAULT_TIMEOUT_MS = 30_000;

/** JSON GET attempts, including the first call. Writes stay at one attempt. */
export const MAX_GET_ATTEMPTS = 3;

/** A 429 whose Retry-After is longer than this is returned instead of slept. */
export const MAX_READ_RETRY_WAIT_MS = 5_000;

/** First backoff when a JSON GET is throttled and Retry-After is absent. */
export const READ_RETRY_BASE_DELAY_MS = 200;

export const MAX_PRIVATE_FILE_BYTES = 10 * 1024 * 1024;

export interface DownloadedFile {
  bytes: Uint8Array;
  contentType: string | null;
}

export interface ApiFile {
  contentType: string | null;
  privateFileId: number | null;
  bytes: Uint8Array | null;
}

export const NON_JSON_BODY_MESSAGE = 'OpenSolar API returned a non-JSON body';

export interface OpenSolarRequestOptions {
  timeoutMs?: number;
}

type WriteMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface OpenSolarClient {
  get(path: string, options?: OpenSolarRequestOptions): Promise<unknown>;
  post(path: string, body: unknown, options?: OpenSolarRequestOptions): Promise<unknown>;
  postForm(path: string, form: FormData, options?: OpenSolarRequestOptions): Promise<unknown>;
  put(path: string, body: unknown, options?: OpenSolarRequestOptions): Promise<unknown>;
  patch(path: string, body: unknown, options?: OpenSolarRequestOptions): Promise<unknown>;
  delete(path: string, options?: OpenSolarRequestOptions): Promise<unknown>;
  download(url: string, options?: OpenSolarRequestOptions): Promise<DownloadedFile>;
  getFile(
    path: string,
    options?: OpenSolarRequestOptions & { readBody?: boolean },
  ): Promise<ApiFile>;
  resourceUrl(path: string): string;
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'TimeoutError';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function readRetryDelayMs(
  retryAfter: string | null,
  failedAttempt: number,
  now = Date.now(),
): number | null {
  const header = retryAfter?.trim() ?? '';
  if (header !== '') {
    return retryAfterWaitMs(header, now);
  }
  return READ_RETRY_BASE_DELAY_MS * 2 ** (failedAttempt - 1);
}

function retryAfterWaitMs(header: string, now: number): number | null {
  if (/^\d+$/.test(header)) {
    const waitMs = Number(header) * 1000;
    return waitMs > MAX_READ_RETRY_WAIT_MS ? null : waitMs;
  }
  const parsed = Date.parse(header);
  if (Number.isNaN(parsed)) {
    return null;
  }
  const waitMs = Math.max(0, parsed - now);
  return waitMs > MAX_READ_RETRY_WAIT_MS ? null : waitMs;
}

function withTrailingSlash(path: string): string {
  const queryIndex = path.indexOf('?');
  const pathname = queryIndex === -1 ? path : path.slice(0, queryIndex);
  if (pathname.endsWith('/')) {
    return path;
  }
  const slashed = `${pathname}/`;
  return queryIndex === -1 ? slashed : `${slashed}${path.slice(queryIndex)}`;
}

export function createClient(
  auth: { token: string; baseUrl: string },
  deps?: { sleep?: (ms: number) => Promise<void> },
): OpenSolarClient {
  const sleep = deps?.sleep ?? delay;

  async function request(
    method: 'GET' | WriteMethod,
    path: string,
    options?: OpenSolarRequestOptions,
    payload?: { json: unknown } | { form: FormData },
  ): Promise<unknown> {
    const requestPath = method === 'GET' ? path : withTrailingSlash(path);
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const url = new URL(requestPath.replace(/^\//, ''), auth.baseUrl);
    const maxAttempts = method === 'GET' ? MAX_GET_ATTEMPTS : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${auth.token}`,
        Accept: 'application/json',
      };
      const init: RequestInit = {
        method,
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      };
      if (payload !== undefined && 'form' in payload) {
        // fetch sets the multipart boundary. A manual Content-Type would drop it.
        init.body = payload.form;
      } else if (payload !== undefined) {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(payload.json);
      }

      let response: Response;
      try {
        response = await fetch(url, init);
      } catch (error) {
        if (isTimeoutError(error)) {
          throw new OpenSolarApiError(
            `OpenSolar API timed out after ${timeoutMs}ms on ${method} ${requestPath}`,
            504,
            '',
          );
        }
        throw error;
      }

      const body = await response.text();
      if (response.status === 429 && attempt < maxAttempts) {
        const waitMs = readRetryDelayMs(response.headers.get('retry-after'), attempt);
        if (waitMs === null) {
          throw new OpenSolarApiError(
            `OpenSolar API 429 ${response.statusText} on ${method} ${requestPath}`,
            429,
            body,
          );
        }
        await sleep(waitMs);
        continue;
      }
      if (!response.ok) {
        throw new OpenSolarApiError(
          `OpenSolar API ${response.status} ${response.statusText} on ${method} ${requestPath}`,
          response.status,
          body,
        );
      }
      if (body === '') {
        return null;
      }
      try {
        const parsed: unknown = JSON.parse(body);
        return parsed;
      } catch {
        throw new OpenSolarApiError(NON_JSON_BODY_MESSAGE, response.status, '');
      }
    }

    throw new OpenSolarApiError(`OpenSolar API 429 on ${method} ${requestPath}`, 429, '');
  }

  function privateFileIdFromFileResponse(response: Response): number | null {
    const fromUrl = privateFileIdFromText(response.url);
    if (fromUrl !== null) {
      return fromUrl;
    }
    for (const value of response.headers.values()) {
      const id = privateFileIdFromText(value);
      if (id !== null) {
        return id;
      }
    }
    return null;
  }

  return {
    get(path, options) {
      return request('GET', path, options);
    },
    post(path, body, options) {
      return request('POST', path, options, { json: body });
    },
    postForm(path, form, options) {
      return request('POST', path, options, { form });
    },
    put(path, body, options) {
      return request('PUT', path, options, { json: body });
    },
    patch(path, body, options) {
      return request('PATCH', path, options, { json: body });
    },
    delete(path, options) {
      return request('DELETE', path, options);
    },
    async getFile(path, options) {
      const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const url = new URL(path.replace(/^\//, ''), auth.baseUrl);
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            Authorization: `Bearer ${auth.token}`,
          },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if (isTimeoutError(error)) {
          throw new OpenSolarApiError(
            `OpenSolar API timed out after ${timeoutMs}ms on GET ${path}`,
            504,
            '',
          );
        }
        throw error;
      }

      if (!response.ok) {
        await response.body?.cancel();
        throw new OpenSolarApiError(
          `OpenSolar API ${response.status} ${response.statusText} on GET ${path}`,
          response.status,
          '',
        );
      }

      const contentType = response.headers.get('content-type');
      const privateFileId = privateFileIdFromFileResponse(response);
      if (options?.readBody !== true) {
        await response.body?.cancel();
        return { contentType, privateFileId, bytes: null };
      }

      const declaredLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_PRIVATE_FILE_BYTES) {
        await response.body?.cancel();
        throw new OpenSolarApiError('System image is over 10 MB', 413, '');
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_PRIVATE_FILE_BYTES) {
        throw new OpenSolarApiError('System image is over 10 MB', 413, '');
      }
      return { contentType, privateFileId, bytes };
    },
    async download(url, options) {
      const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new OpenSolarApiError('OpenSolar file download failed', 400, '');
      }
      if (parsed.protocol !== 'https:' || parsed.username !== '' || parsed.password !== '') {
        throw new OpenSolarApiError('OpenSolar file download failed', 400, '');
      }

      let response: Response;
      try {
        response = await fetch(parsed, {
          method: 'GET',
          redirect: 'follow',
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if (isTimeoutError(error)) {
          throw new OpenSolarApiError(
            `OpenSolar file download timed out after ${timeoutMs}ms`,
            504,
            '',
          );
        }
        throw error;
      }

      if (!response.ok) {
        await response.body?.cancel();
        throw new OpenSolarApiError('OpenSolar file download failed', response.status, '');
      }

      const declaredLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_PRIVATE_FILE_BYTES) {
        await response.body?.cancel();
        throw new OpenSolarApiError('Private file is over 10 MB', 413, '');
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_PRIVATE_FILE_BYTES) {
        throw new OpenSolarApiError('Private file is over 10 MB', 413, '');
      }
      return {
        bytes,
        contentType: response.headers.get('content-type'),
      };
    },
    resourceUrl(path) {
      return new URL(path.replace(/^\//, ''), auth.baseUrl).toString();
    },
  };
}
