/**
 * The addresses a cloud provider answers its own instances on.
 *
 * `169.254.169.254` is the one that matters: on almost every hosted provider
 * it hands out short-lived credentials for the instance to anything that asks
 * from inside, with no authentication, because being inside *is* the
 * authentication. A server that will fetch a URL somebody supplied is a
 * server that will fetch that one, and hand the answer to whoever asked.
 */
const LINK_LOCAL_FIRST_OCTET = 169;

const LINK_LOCAL_SECOND_OCTET = 254;

/**
 * Names that resolve to a metadata service without looking like an address.
 *
 * Blocking the address alone would leave the name, and the name is what the
 * provider's own documentation tells people to use.
 */
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

/**
 * The first half of the link-local range written the way IPv6 writes it.
 *
 * 169 and 254 are `a9` and `fe`, which is what `169.254.` becomes once a URL
 * parser has canonicalised a mapped address into hex.
 */
const LINK_LOCAL_IPV6_GROUP = 'a9fe';

/**
 * Whether an IPv6 literal is link-local, including one wearing an IPv4 suffix.
 *
 * `fe80::/10` covers the ordinary form. The mapped form matters separately
 * because `::ffff:169.254.169.254` reaches exactly the same place as the
 * dotted quad does, and reads as neither to anything matching on shape.
 *
 * Both spellings of the mapped form are checked, because writing it as a
 * dotted quad is what somebody trying it would type and hex is what comes
 * back out of the parser afterwards.
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
 * Loopback and the private ranges are deliberately allowed. Pointing Flux at
 * ntfy on the same box, or at Home Assistant across the landing, is the normal
 * case for this feature rather than an attack — refusing them would break the
 * common setup to defend against the operator's own network.
 *
 * What is refused is the link-local range and the metadata hostnames that sit
 * in it, because those are a credential-theft path on any hosted instance and
 * nothing legitimate points a webhook at them.
 *
 * What this does **not** do is resolve the name. A hostname that answers with
 * a link-local address, or answers differently the second time it is asked,
 * gets through — stopping that means resolving here and pinning the address
 * through to the socket, which is a larger change than this feature justifies
 * while creating a subscription is itself a restricted permission. The guard
 * is a second lock on a door that is already locked, not the only one.
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
