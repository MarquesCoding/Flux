import { networkInterfaces } from 'node:os';

/**
 * Every address this machine answers on, as far as the network is concerned.
 */
const ownAddresses = (): string[] =>
  Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => !entry.internal && entry.family === 'IPv4')
    .map((entry) => entry.address);

/**
 * Collects the ports Valence is already known to be read at, from the origins an operator configured,
 * so that guessing an address for this machine guesses the right port. An origin that will not
 * parse is skipped rather than failing the lot.
 *
 * @param origins - The origins an operator configured.
 * @param fallback - The port to include regardless, being the one Valence is listening on.
 * @returns Every port worth trying, without duplicates.
 */
const portsIn = (origins: string[], fallback: number): number[] => {
  const found = origins.flatMap((origin) => {
    try {
      const port = new URL(origin).port;

      return port === '' ? [] : [Number(port)];
    } catch {
      return [];
    }
  });

  return [...new Set([...found, fallback])];
};

/**
 * Works out the addresses this machine can be read at — every network interface it has, at every
 * port already in use — so that a household reaching the server by its local address is trusted
 * without an operator having to write each one down. Configured origins are always included.
 *
 * @param configured - The origins an operator wrote down.
 * @param fallbackPort - The port Valence is listening on.
 * @returns Every origin to trust.
 */
const ownOrigins = (configured: string[], fallbackPort: number): string[] => {
  const ports = portsIn(configured, fallbackPort);

  return ownAddresses().flatMap((address) =>
    ports.flatMap((port) => [
      `http://${address}:${port.toString()}`,
      `https://${address}:${port.toString()}`,
    ]),
  );
};

export { ownOrigins, ownAddresses, portsIn };
