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

export interface OpenSolarRequestOptions {
  timeoutMs?: number;
}

export interface OpenSolarClient {
  get(path: string, options?: OpenSolarRequestOptions): Promise<unknown>;
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'TimeoutError';
}

export function createClient(auth: { token: string; baseUrl: string }): OpenSolarClient {
  return {
    async get(path: string, options?: OpenSolarRequestOptions): Promise<unknown> {
      const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const url = new URL(path.replace(/^\//, ''), auth.baseUrl);
      let response: Response;
      try {
        response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${auth.token}`,
            Accept: 'application/json',
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

      const body = await response.text();
      if (!response.ok) {
        throw new OpenSolarApiError(
          `OpenSolar API ${response.status} ${response.statusText} on GET ${path}`,
          response.status,
          body,
        );
      }
      return body === '' ? null : JSON.parse(body);
    },
  };
}
