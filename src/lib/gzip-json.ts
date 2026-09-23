import { gunzipSync } from 'node:zlib';

/** Maximum uncompressed JSON accepted from OpenSolar compressed Raw Data blobs. */
export const MAX_GZIP_JSON_OUTPUT_BYTES = 64 * 1024 * 1024;

/** OpenSolar stores some blobs as base64(gzip(JSON)), prefixed `H4sI`. */
export function decodeGzipJson(
  value: string,
  maxOutputLength = MAX_GZIP_JSON_OUTPUT_BYTES,
): unknown {
  try {
    const json = gunzipSync(Buffer.from(value, 'base64'), { maxOutputLength }).toString('utf8');
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}
