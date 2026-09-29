import { DEFAULT_REDACTION } from './redaction.js';

const INLINE_SECRET_PATTERNS = DEFAULT_REDACTION.valuePatterns.map(
  (pattern) => new RegExp(pattern.source.replace(/^\^/, ''), `${pattern.flags.replace('g', '')}g`),
);

const FIELD_KEY = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_DEPTH = 3;
const MAX_PAIRS = 8;
const MAX_MESSAGE_CHARS = 200;
const MAX_DETAILS_CHARS = 800;

function redactInline(message: string): string {
  return INLINE_SECRET_PATTERNS.reduce(
    (text, pattern) => text.replace(pattern, '[REDACTED]'),
    message,
  );
}

function sanitizeMessage(message: string): string {
  const redacted = redactInline(message).replace(/https?:\/\/\S+/g, '[url]');
  const collapsed = redacted.replace(/\s+/g, ' ').trim();
  return collapsed.length > MAX_MESSAGE_CHARS ? collapsed.slice(0, MAX_MESSAGE_CHARS) : collapsed;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pathForKey(key: string): string {
  return key === 'detail' || key === 'non_field_errors' ? 'request' : key;
}

function collectPairs(value: unknown, path: string, depth: number, pairs: string[]): void {
  if (pairs.length >= MAX_PAIRS || depth > MAX_DEPTH) {
    return;
  }
  if (typeof value === 'string') {
    pairs.push(`${path}: ${sanitizeMessage(value)}`);
    return;
  }
  if (isStringArray(value)) {
    for (const entry of value) {
      if (pairs.length >= MAX_PAIRS) {
        return;
      }
      pairs.push(`${path}: ${sanitizeMessage(entry)}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      collectPairs(entry, `${path}[${index}]`, depth + 1, pairs);
      if (pairs.length >= MAX_PAIRS) {
        return;
      }
    }
    return;
  }
  if (!isPlainObject(value)) {
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (!FIELD_KEY.test(key)) {
      continue;
    }
    const nextPath = path === '' ? pathForKey(key) : `${path}.${pathForKey(key)}`;
    collectPairs(entry, nextPath, depth + 1, pairs);
    if (pairs.length >= MAX_PAIRS) {
      return;
    }
  }
}

export function validationDetails(body: string): string | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return undefined;
  }
  if (!isPlainObject(parsed)) {
    return undefined;
  }
  const pairs: string[] = [];
  collectPairs(parsed, '', 0, pairs);
  if (pairs.length === 0) {
    return undefined;
  }
  const joined = pairs.slice(0, MAX_PAIRS).join('; ');
  return joined.length > MAX_DETAILS_CHARS ? joined.slice(0, MAX_DETAILS_CHARS) : joined;
}
