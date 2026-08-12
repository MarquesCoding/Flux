import type { Monitor } from '@FluxWeb/admin/fetchAdmin';

type EventsPanelProps = {
  /**
   * The latest reading, or null before one has arrived.
   *
   * Null and "arrived with nothing in it" are shown the same way: neither is
   * an error, and both mean there is nothing to read yet.
   */
  monitor: Monitor | null;
};

export type { EventsPanelProps };
