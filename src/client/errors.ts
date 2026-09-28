import { validationDetails } from '../lib/validation-details.js';
import { OpenSolarApiError } from './index.js';

export function messageForOpenSolarError(error: OpenSolarApiError): string {
  switch (error.status) {
    case 400:
    case 409:
    case 422: {
      const details = validationDetails(error.body);
      return details === undefined
        ? `OpenSolar rejected the request (HTTP ${error.status}).`
        : `OpenSolar rejected the request (HTTP ${error.status}): ${details}`;
    }
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
      if (error.method !== undefined && error.method !== 'GET') {
        return 'Timed out waiting for OpenSolar during a write (HTTP 504). The change may or may not have been applied. Read the record to check before retrying, so you do not create a duplicate.';
      }
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

export function structuredContentText(structuredContent: unknown): {
  type: 'text';
  text: string;
} {
  const serialized = JSON.stringify(structuredContent);
  if (serialized === undefined) {
    throw new Error('Structured tool output must be JSON-serializable');
  }
  return { type: 'text', text: serialized };
}

export function openSolarSuccess<T>(
  structuredContent: T,
  text: string,
): {
  content: [{ type: 'text'; text: string }, { type: 'text'; text: string }];
  structuredContent: T;
} {
  return {
    content: [{ type: 'text', text }, structuredContentText(structuredContent)],
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
