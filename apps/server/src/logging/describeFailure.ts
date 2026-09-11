const DEPTH = 4;

/**
 * Finds the failure underneath one, whether it was given as a cause or gathered with others.
 *
 * @param error - The failure to look beneath.
 * @returns What it was caused by, or null where it says nothing further.
 */
const beneath = (error: Error): Error | null => {
  if (error.cause instanceof Error) {
    return error.cause;
  }

  if (error instanceof AggregateError) {
    for (const gathered of error.errors) {
      if (gathered instanceof Error) {
        return gathered;
      }
    }
  }

  return null;
};

/**
 * Says what went wrong in one line, following the causes underneath.
 *
 * Node reports every network fault as "fetch failed" and puts what actually happened — a timeout, a
 * refused connection, a socket closed underneath — in the cause beneath it. Reporting only the top
 * of that chain tells an operator that something failed and nothing about what, which is the
 * difference between a problem they can act on and one they can only pass on.
 *
 * An address that resolves several ways is tried several ways, and the failures arrive gathered in
 * an AggregateError, which carries no message of its own and holds every attempt in `errors`
 * instead of in `cause`. Following only `cause` there ends the chain on an empty line and reports
 * the bare "fetch failed" this exists to avoid.
 *
 * Written for the scan and now used by anything that reports a fault to an operator, which is why
 * it lives beside the log rather than beside the scanner.
 *
 * @param error - What was thrown.
 * @returns What went wrong, with its causes, as one line.
 */
const describeFailure = (error: Error): string => {
  const said: string[] = [];
  let held: Error | null = error;

  for (let depth = 0; depth < DEPTH && held !== null; depth += 1) {
    const code = 'code' in held && typeof held.code === 'string' ? held.code : null;
    const line = code === null ? held.message : `${held.message} (${code})`;

    if (line !== '' && !said.includes(line)) {
      said.push(line);
    }

    held = beneath(held);
  }

  return said.length === 0 ? 'It failed, and said nothing about why.' : said.join(': ');
};

export { describeFailure };
