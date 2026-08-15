import type { Monitor } from '@FluxWeb/admin/fetchAdmin';
import type { Stat } from '@FluxWeb/components/AdminArea/components/StatStrip/StatStrip.types';

/**
 * What the graphics tile says, and what it refuses to say.
 */
const describeGraphics = (graphics: Monitor['resources']['graphics']): Omit<Stat, 'label'> => {
  if (graphics === null) {
    return { value: '—', detail: 'No card Flux can read' };
  }

  if (graphics.encoderPercent !== null) {
    return {
      value: `${graphics.encoderPercent.toFixed(0)}%`,
      fraction: graphics.encoderPercent / 100,
      detail: 'encoder, not whole card',
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
