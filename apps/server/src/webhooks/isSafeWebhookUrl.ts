const LINK_LOCAL_FIRST_OCTET = 169;

const LINK_LOCAL_SECOND_OCTET = 254;

const METADATA_HOSTNAMES = new Set(['metadata.google.internal', 'metadata.goog']);

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * Decides whether an address is in the link-local range, which on a cloud host is where the instance
 * metadata service lives — the one address a webhook must never be pointed at, since anything that
 * can read it can read the machine's credentials.
 *
 * @param hostname - The address as four numbers.
 * @returns Whether it is link-local.
 */
const isLinkLocalIpv4 = (hostname: string): boolean => {
  const match = IPV4.exec(hostname);

  if (match === null) {
    return false;
  }

  const [first, second] = [Number(match[1]), Number(match[2])];

  return first === LINK_LOCAL_FIRST_OCTET && second === LINK_LOCAL_SECOND_OCTET;
};

const LINK_LOCAL_IPV6_GROUP = 'a9fe';

/**
 * Decides whether an IPv6 literal is link-local, including the forms that wear an IPv4 address as a
 * suffix and the hexadecimal spelling of the same — all of which reach the same metadata service by
 * a different-looking route.
 *
 * @param hostname - The literal as written in the address.
 * @returns Whether it is link-local.
 */
const isLinkLocalIpv6 = (hostname: string): boolean => {
  const address = hostname.replace('[', '').replace(']', '').toLowerCase();

  if (/^fe[89ab]/.test(address)) {
    return true;
  }

  const mapped = /^::ffff:(.+)$/.exec(address);
  const tail = mapped?.[1];

  if (tail === undefined) {
    return false;
  }

  return isLinkLocalIpv4(tail) || tail.split(':')[0] === LINK_LOCAL_IPV6_GROUP;
};

/**
 * Whether Flux is willing to send a delivery to this address.
 *
 * @param candidate The address an operator asked deliveries to be sent to.
 */
const isSafeWebhookUrl = (candidate: string): boolean => {
  const url = URL.parse(candidate);

  if (url === null) {
    return false;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }

  const hostname = url.hostname.toLowerCase();

  if (METADATA_HOSTNAMES.has(hostname)) {
    return false;
  }

  if (hostname.includes(':')) {
    return !isLinkLocalIpv6(hostname);
  }

  return !isLinkLocalIpv4(hostname);
};

export { isSafeWebhookUrl };
