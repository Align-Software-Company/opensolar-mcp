import { OpenSolarApiError } from './index.js';

export function messageForOpenSolarError(error: OpenSolarApiError): string {
  switch (error.status) {
    case 401:
      return 'Token missing or expired. Normal tokens last 7 days. A machine user does not expire';
    case 402:
      return 'This call needs Raw Data API Access';
    case 403:
      return 'The caller cannot use this record. OpenSolar uses 403 even when the record exists';
    case 404:
      return 'The record was not found';
    case 429:
      return 'Throttled. Wait. Do not loop';
    case 504:
      return 'Timed out. Large projects can time out upstream. Do not loop';
    default:
      return `OpenSolar API returned HTTP ${error.status}`;
  }
}

export function openSolarToolResult(error: OpenSolarApiError): {
  isError: true;
  content: [{ type: 'text'; text: string }];
} {
  return {
    isError: true,
    content: [{ type: 'text', text: messageForOpenSolarError(error) }],
  };
}

export function openSolarSuccess<T>(
  structuredContent: T,
  text: string,
): {
  content: [{ type: 'text'; text: string }];
  structuredContent: T;
} {
  return {
    content: [{ type: 'text', text }],
    structuredContent,
  };
}

export async function runOpenSolarTool<T>(
  run: () => Promise<T>,
): Promise<T | ReturnType<typeof openSolarToolResult>> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof OpenSolarApiError) {
      return openSolarToolResult(error);
    }
    throw error;
  }
}
