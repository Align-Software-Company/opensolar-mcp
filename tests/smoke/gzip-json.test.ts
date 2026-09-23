import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  decodeGzipJson,
  MAX_GZIP_JSON_OUTPUT_BYTES,
} from '../../src/lib/gzip-json.js';

describe('decodeGzipJson', () => {
  it('decodes gzip JSON within the output bound', () => {
    const encoded = gzipSync(Buffer.from(JSON.stringify({ ok: true }))).toString('base64');
    expect(decodeGzipJson(encoded)).toEqual({ ok: true });
    expect(MAX_GZIP_JSON_OUTPUT_BYTES).toBe(64 * 1024 * 1024);
  });

  it('returns null when decompressed output exceeds the bound', () => {
    const encoded = gzipSync(Buffer.from(JSON.stringify({ value: 'x'.repeat(256) }))).toString(
      'base64',
    );
    expect(decodeGzipJson(encoded, 32)).toBeNull();
  });

  it('returns null for invalid compressed data', () => {
    expect(decodeGzipJson('not-gzip')).toBeNull();
  });
});
