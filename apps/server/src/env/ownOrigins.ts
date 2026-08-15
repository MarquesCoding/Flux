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
 * The ports somebody is already known to read Flux at.
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
 * The addresses this machine can be read at, trusted without being written down.
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
