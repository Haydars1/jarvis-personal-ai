function isPrivateOrLocalIpv4(octets) {
  if (!Array.isArray(octets) || octets.length !== 4 || octets.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || a >= 224;
}

function literalIpv4Octets(host) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return null;
  const octets = host.split('.').map(part => Number(part));
  return octets.every(part => Number.isInteger(part) && part >= 0 && part <= 255) ? octets : null;
}

function mappedIpv4Octets(ipv6) {
  const match = String(ipv6 || '').match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!match) return null;
  const high = Number.parseInt(match[1], 16);
  const low = Number.parseInt(match[2], 16);
  return [high >> 8, high & 0xff, low >> 8, low & 0xff];
}

export function isSafeRegisteredWorkerEndpoint(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || !url.pathname.endsWith('/jobs')) return false;
    if (url.username || url.password || url.search || url.hash) return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]' || host.endsWith('.local')) return false;
    const literalIpv4 = literalIpv4Octets(host);
    if (literalIpv4 && isPrivateOrLocalIpv4(literalIpv4)) return false;
    const ipv6 = host.replace(/^\[|\]$/g, '');
    if (/^(fc|fd)[0-9a-f]{2}:/i.test(ipv6) || /^fe[89ab][0-9a-f]:/i.test(ipv6)) return false;
    const mappedIpv4 = mappedIpv4Octets(ipv6);
    if (mappedIpv4 && isPrivateOrLocalIpv4(mappedIpv4)) return false;
    return true;
  } catch {
    return false;
  }
}
