/**
 * Flux's share of the processor, as the tile says it.
 *
 * Rounding is the whole point. A media service idling on a fifteen core
 * machine uses a fraction of one of them, which rounds to zero and then reads
 * as "not running" beside a system figure of sixteen percent. Anything above
 * nothing says so as `<1%`, which is the difference between a service that is
 * quiet and a service that is stopped.
 */
const describeCpuShare = (share: number | null): string => {
  if (share === null) {
    return 'not measured';
  }

  if (share <= 0) {
    return '0%';
  }

  return share < 1 ? '<1%' : `${share.toFixed(0)}%`;
};

export { describeCpuShare };
