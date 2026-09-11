const DEPTH = 4;

/**
 * Says what went wrong in one line, following the causes underneath.
 *
 * Node reports every network fault as "fetch failed" and puts what actually happened — a timeout, a
 * refused connection, a socket closed underneath — in the cause beneath it. Reporting only the top
 * of that chain tells an operator that something failed and nothing about what, which is the
 * difference between a problem they can act on and one they can only pass on.
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

    held = held.cause instanceof Error ? held.cause : null;
  }

  return said.length === 0 ? 'Probe failed.' : said.join(': ');
};

export { describeFailure };
