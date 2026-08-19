const NOWHERE = 'http://flux.invalid/';

const held = new URL(NOWHERE);

/**
 * The address a browser is opened at to sign somebody in.
 *
 * One object, handed over once and changed in place. The library reads the address when somebody
 * asks to sign in, but it copies its options when it is built — so a value read at build time is the
 * value it keeps, and at build time nobody has said where their Flux is yet. A `URL` survives that
 * copy by reference, which is what makes an address that is only known later reachable at all.
 *
 * It starts at an address that resolves nowhere rather than at nothing, because nothing is not a URL
 * and the library would throw on it before a browser ever opened.
 *
 * @returns The address, as the object the library was given.
 */
const whereToSignIn = (): URL => held;

/**
 * Points signing in at the server somebody named.
 *
 * @param address - Where their Flux is, or nothing where they have not said.
 */
const pointSignInAt = (address: string): void => {
  const read = address === '' ? null : URL.parse(address);

  held.href = read === null ? NOWHERE : `${read.href.replace(/\/+$/, '')}/`;
};

export { pointSignInAt, whereToSignIn };
