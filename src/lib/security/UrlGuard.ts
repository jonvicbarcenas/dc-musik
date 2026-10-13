import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import { MusicError } from '../utils/errors.js';

export interface PublicAddress {
  address: string;
  family: 4 | 6;
}
export type AddressLookup = (hostname: string) => Promise<PublicAddress[]>;

export function isPublicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === 'unicast';
  } catch {
    return false;
  }
}

/** Reject every non-public answer, including mapped IPv4, metadata IPs, and rebinding answers. */
export class UrlGuard {
  constructor(
    private readonly resolve: AddressLookup = async (hostname) => {
      const answers = await lookup(hostname, { all: true, verbatim: true });
      return answers.map((answer) => ({
        address: answer.address,
        family: answer.family === 6 ? 6 : 4,
      }));
    },
  ) {}

  async validate(input: string): Promise<{ url: URL; addresses: PublicAddress[] }> {
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      throw unsafe();
    }
    if (
      input.length > 4096 ||
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      !['', '80', '443'].includes(url.port) ||
      url.hash ||
      [...input].some((c) => (c.codePointAt(0) ?? 0) < 32)
    )
      throw unsafe();
    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (
      hostname === 'localhost' ||
      (!hostname.includes('.') && !isIP(hostname)) ||
      /\.(?:localhost|local|internal|lan|home|test|invalid|onion)$/.test(hostname)
    )
      throw unsafe();
    let addresses: PublicAddress[];
    try {
      addresses = isIP(hostname)
        ? [{ address: hostname, family: isIP(hostname) === 6 ? 6 : 4 }]
        : await this.resolve(hostname);
    } catch {
      throw unsafe();
    }
    if (addresses.length === 0 || addresses.some((answer) => !isPublicAddress(answer.address)))
      throw unsafe();
    return { url, addresses };
  }
}
function unsafe(): MusicError {
  return new MusicError(
    'UNSAFE_URL',
    'Use a public HTTP or HTTPS URL without credentials or a custom port.',
  );
}
