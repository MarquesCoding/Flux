const LINK_LOCAL_FIRST_OCTET = 169;

const LINK_LOCAL_SECOND_OCTET = 254;

const METADATA_HOSTNAMES = new Set(['metadata.google.internal', 'metadata.goog']);

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * Whether a dotted-quad is in the link-local range.
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
 * Whether an IPv6 literal is link-local, including one wearing an IPv4 suffix.
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
