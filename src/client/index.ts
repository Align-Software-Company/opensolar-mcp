import type { Config } from '../lib/config.js';

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

export interface OpenSolarClient {
  get(path: string): Promise<unknown>;
}

export function createClient(config: Config): OpenSolarClient {
  return {
    async get(path: string): Promise<unknown> {
      const url = new URL(path.replace(/^\//, ''), config.BASE_URL);
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${config.OPENSOLAR_API_TOKEN}`,
          Accept: 'application/json',
        },
      });

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
