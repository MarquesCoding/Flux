/**
 * How many files to render at once, given what was asked for and what the machine proved.
 *
 * The smaller of the two. A count worked out from processors says nothing about a graphics chip: a
 * render on the device costs a session and a share of the device's memory, and there are a fixed
 * number of both however many cores sit beside them. Asking a machine for more of those than it has
 * does not make it slower, it makes the renders fail — and on the way it starves whatever somebody
 * is watching, which is worse than a scan that takes longer.
 *
 * Nothing measured means nothing to be bounded by, which is the honest answer for a machine with no
 * hardware to render on and for one this build could not ask.
 *
 * @param asked - How many the operator or the default wants.
 * @param measured - How many hardware renders the machine proved it will run at once, or zero.
 * @returns How many to actually run.
 */
const filesAtOnce = (asked: number, measured: number): number =>
  measured <= 0 ? asked : Math.min(asked, measured);

export { filesAtOnce };
