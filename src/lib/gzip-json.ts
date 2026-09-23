import { gunzipSync } from 'node:zlib';

/** OpenSolar stores some blobs as base64(gzip(JSON)), prefixed `H4sI`. */
export function decodeGzipJson(value: string): unknown {
  try {
    const json = gunzipSync(Buffer.from(value, 'base64')).toString('utf8');
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}
