const SCHEMES = ['http://', 'https://'];

const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Reads what somebody typed as the address of a Flux server, or says why it is not one.
 *
 * Typing a bare host is what people do, so a missing scheme is filled in rather than refused. A
 * trailing slash is dropped because every path is joined onto this and two slashes reach nothing.
 *
 * @param typed - What they entered.
 * @returns The address to keep, or the reason it cannot be used.
 */
const readServerAddress = (typed: string): { address: string } | { problem: string } => {
  const trimmed = typed.trim();

  if (trimmed === '') {
    return { problem: 'Enter the address of your Flux server.' };
  }

  if (
    ANY_SCHEME.test(trimmed) &&
    !SCHEMES.some((scheme) => trimmed.toLowerCase().startsWith(scheme))
  ) {
    return { problem: 'A Flux server is reached over http or https.' };
  }

  const withScheme = ANY_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;

  const read = URL.parse(withScheme);

  if (read === null || read.hostname === '') {
    return { problem: 'That does not look like a web address.' };
  }

  if (!SCHEMES.includes(`${read.protocol}//`)) {
    return { problem: 'A Flux server is reached over http or https.' };
  }

  return { address: `${read.origin}${read.pathname.replace(/\/+$/, '')}` };
};

export { readServerAddress };
