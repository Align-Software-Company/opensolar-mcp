import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

/** Followed Location hops. The response that is still a redirect after this is refused. */
export const MAX_DOWNLOAD_REDIRECTS = 5;

export type HostLookup = (hostname: string) => Promise<readonly string[]>;

export class UnsafeDownloadTargetError extends Error {
  constructor() {
    super('OpenSolar file download failed');
    this.name = 'UnsafeDownloadTargetError';
  }
}

// Not globally reachable, plus transition ranges that can embed those addresses.
const nonPublicAddresses = new BlockList();

function block(address: string, prefix: number, family: 'ipv4' | 'ipv6'): void {
  nonPublicAddresses.addSubnet(address, prefix, family);
}

block('0.0.0.0', 8, 'ipv4');
block('10.0.0.0', 8, 'ipv4');
block('100.64.0.0', 10, 'ipv4');
block('127.0.0.0', 8, 'ipv4');
block('169.254.0.0', 16, 'ipv4');
block('172.16.0.0', 12, 'ipv4');
block('192.0.0.0', 24, 'ipv4');
block('192.0.2.0', 24, 'ipv4');
block('192.168.0.0', 16, 'ipv4');
block('198.18.0.0', 15, 'ipv4');
block('198.51.100.0', 24, 'ipv4');
block('203.0.113.0', 24, 'ipv4');
block('224.0.0.0', 4, 'ipv4');
block('240.0.0.0', 4, 'ipv4');

block('::', 96, 'ipv6');
block('64:ff9b::', 96, 'ipv6');
block('64:ff9b:1::', 48, 'ipv6');
block('100::', 64, 'ipv6');
block('2001::', 32, 'ipv6');
block('2001:2::', 48, 'ipv6');
block('2001:db8::', 32, 'ipv6');
block('2002::', 16, 'ipv6');
block('fc00::', 7, 'ipv6');
block('fe80::', 10, 'ipv6');
block('fec0::', 10, 'ipv6');
block('ff00::', 8, 'ipv6');

export async function defaultLookupHost(hostname: string): Promise<readonly string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

/**
 * Signed file URLs may redirect. `redirect: 'follow'` would request the next
 * Location before this process can reject it, so each hop is checked here.
 */
export async function acceptedDownloadUrl(
  input: string,
  lookupHost: HostLookup,
  base?: URL,
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = base === undefined ? new URL(input) : new URL(input, base);
  } catch {
    throw new UnsafeDownloadTargetError();
  }
  if (parsed.protocol !== 'https:' || parsed.username !== '' || parsed.password !== '') {
    throw new UnsafeDownloadTargetError();
  }

  const host = unbracket(parsed.hostname);
  if (isIP(host) !== 0) {
    if (isBlockedAddress(host)) {
      throw new UnsafeDownloadTargetError();
    }
    return parsed;
  }

  let addresses: readonly string[];
  try {
    addresses = await lookupHost(host);
  } catch {
    throw new UnsafeDownloadTargetError();
  }
  if (addresses.length === 0 || addresses.some((address) => isBlockedAddress(address))) {
    throw new UnsafeDownloadTargetError();
  }
  return parsed;
}

function unbracket(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

function isBlockedAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    return nonPublicAddresses.check(address, 'ipv4');
  }
  if (version === 6) {
    return nonPublicAddresses.check(address, 'ipv6');
  }
  return true;
}
