import { describe, expect, it } from 'vitest';
import {
  acceptedDownloadUrl,
  defaultLookupHost,
  type HostLookup,
  UnsafeDownloadTargetError,
} from '../../src/client/download-target.js';

const publicLookup: HostLookup = async () => ['1.1.1.1'];
const unusedLookup: HostLookup = async () => {
  throw new Error('lookup should not run');
};

async function accepted(input: string, lookupHost: HostLookup = unusedLookup, base?: URL) {
  return acceptedDownloadUrl(input, lookupHost, base);
}

describe('acceptedDownloadUrl', () => {
  it('accepts an https URL whose addresses are public', async () => {
    const url = await accepted(
      'https://files.example.test/private/site.json?Signature=fixture',
      publicLookup,
    );

    expect(url.hostname).toBe('files.example.test');
  });

  it('accepts a public address literal without a lookup', async () => {
    const url = await accepted('https://1.1.1.1/file');

    expect(url.hostname).toBe('1.1.1.1');
  });

  it('rejects a non-https URL, userinfo, and an unparseable URL', async () => {
    await expect(accepted('http://files.example.test/file')).rejects.toBeInstanceOf(
      UnsafeDownloadTargetError,
    );
    await expect(accepted('https://user:pass@files.example.test/file')).rejects.toBeInstanceOf(
      UnsafeDownloadTargetError,
    );
    await expect(accepted('not a url')).rejects.toBeInstanceOf(UnsafeDownloadTargetError);
  });

  it('rejects loopback, link-local, and obfuscated loopback literals', async () => {
    await expect(accepted('https://127.0.0.1/internal')).rejects.toBeInstanceOf(
      UnsafeDownloadTargetError,
    );
    await expect(accepted('https://169.254.169.254/latest/meta-data')).rejects.toBeInstanceOf(
      UnsafeDownloadTargetError,
    );
    await expect(accepted('https://2130706433/')).rejects.toBeInstanceOf(UnsafeDownloadTargetError);
    await expect(accepted('https://[::1]/')).rejects.toBeInstanceOf(UnsafeDownloadTargetError);
    await expect(accepted('https://[::ffff:169.254.169.254]/')).rejects.toBeInstanceOf(
      UnsafeDownloadTargetError,
    );
  });

  it('rejects a hostname when any resolved address is non-public', async () => {
    const lookupHost: HostLookup = async () => ['1.1.1.1', '10.0.0.8'];

    await expect(accepted('https://files.example.test/file', lookupHost)).rejects.toBeInstanceOf(
      UnsafeDownloadTargetError,
    );
  });

  it('rejects a failed lookup without keeping the signed URL on the error', async () => {
    const lookupHost: HostLookup = async () => {
      throw new Error('getaddrinfo ENOTFOUND files.example.test');
    };

    const error = await accepted(
      'https://files.example.test/file?Signature=fixture',
      lookupHost,
    ).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(UnsafeDownloadTargetError);
    expect(String(error)).not.toContain('Signature');
    expect(String(error)).not.toContain('files.example.test');
  });

  it('resolves a relative redirect against the current https URL', async () => {
    const url = await accepted(
      'other.json',
      publicLookup,
      new URL('https://files.example.test/private/site.json?Expires=1'),
    );

    expect(url.href).toBe('https://files.example.test/private/other.json');
  });

  it('rejects localhost through name resolution', async () => {
    await expect(accepted('https://localhost/file', defaultLookupHost)).rejects.toBeInstanceOf(
      UnsafeDownloadTargetError,
    );
  });
});
