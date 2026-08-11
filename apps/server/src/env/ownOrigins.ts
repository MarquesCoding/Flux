import { networkInterfaces } from 'node:os'

/**
 * Every address this machine answers on, as far as the network is concerned.
 *
 * Loopback is left out: an address meaning "this machine" is already trusted
 * by name, and offering it as though it were a network address is how a
 * television ends up fetching from itself.
 */
const ownAddresses = (): string[] =>
  Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => !entry.internal && entry.family === 'IPv4')
    .map((entry) => entry.address)

/**
 * The ports somebody is already known to read Flux at.
 *
 * Taken from the origins that have been configured rather than guessed: an
 * operator who trusts `localhost:5173` is running a development server there,
 * and the same server on the same machine is what a phone on the sofa will
 * reach at the address below.
 */
const portsIn = (origins: string[], fallback: number): number[] => {
  const found = origins.flatMap((origin) => {
    try {
      const port = new URL(origin).port

      return port === '' ? [] : [Number(port)]
    } catch {
      return []
    }
  })

  return [...new Set([...found, fallback])]
}

/**
 * The addresses this machine can be read at, trusted without being written
 * down.
 *
 * A self-hosted server is reached from the sofa as often as from the machine
 * it runs on, and every one of those visits arrives from an address the
 * operator never configured — the one the router happened to hand out. Being
 * refused at that address, with no explanation beyond a failed sign-in, is the
 * single most tedious way for this software to appear broken.
 *
 * Only addresses this machine actually holds are trusted, which is a different
 * thing from trusting the network: somebody else's laptop cannot borrow this
 * by asking.
 */
const ownOrigins = (configured: string[], fallbackPort: number): string[] => {
  const ports = portsIn(configured, fallbackPort)

  // Both schemes. A home server is read over plain HTTP most of the time and
  // over TLS whenever a certificate exists — which it must, for casting, since
  // browsers only offer that over a secure connection. Trusting one scheme
  // means being refused the moment a certificate appears.
  return ownAddresses().flatMap((address) =>
    ports.flatMap((port) => [
      `http://${address}:${port.toString()}`,
      `https://${address}:${port.toString()}`,
    ]),
  )
}

export { ownOrigins, ownAddresses, portsIn }
