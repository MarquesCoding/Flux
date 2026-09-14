import type { Monitor } from '@ValenceClient/admin/fetchAdmin';
import type { Stat } from '@ValenceScreens/components/AdminArea/components/StatStrip/StatStrip.types';

/**
 * Decides what the graphics tile says, and is careful about what it refuses to say. Cards report
 * either encoder use or whole-device use and rarely both, and the two are not the same number, so
 * whichever is available is labelled as what it is rather than passed off as the other. A figure
 * the kernel would only attribute to Valence's own work says so too, because a quiet card and a
 * busy one Valence is not using look identical from there.
 *
 * @param graphics - What the monitor read from the card, or null where there is nothing readable.
 * @returns The figure, how full the bar should be, and what the figure actually measures.
 */
const describeGraphics = (graphics: Monitor['resources']['graphics']): Omit<Stat, 'label'> => {
  if (graphics === null) {
    return { value: '—', detail: 'No card Valence can read' };
  }

  if (graphics.encoderPercent !== null) {
    return {
      value: `${graphics.encoderPercent.toFixed(0)}%`,
      fraction: graphics.encoderPercent / 100,
      detail:
        graphics.measured === 'valenceOnly' ? 'video engine, ours only' : 'encoder, not whole card',
    };
  }

  if (graphics.devicePercent !== null) {
    return {
      value: `${graphics.devicePercent.toFixed(0)}%`,
      fraction: graphics.devicePercent / 100,
      detail: 'whole card, not encoder',
    };
  }

  return { value: '—', detail: 'Nothing readable' };
};

export { describeGraphics };
