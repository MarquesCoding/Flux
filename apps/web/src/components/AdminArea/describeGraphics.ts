import type { Monitor } from '@FluxWeb/admin/fetchAdmin';
import type { Stat } from '@FluxWeb/components/AdminArea/components/StatStrip/StatStrip.types';

/**
 * What the graphics tile says, and what it refuses to say.
 *
 * The figure an operator wants is encoder pressure, because that is what
 * decides whether another stream will keep up. Only NVIDIA reports it. Where
 * it cannot be had the tile falls back to what the whole card is doing and
 * says so in the same breath — that figure answers a different question, and
 * on Apple hardware it does not move when Flux encodes at all, because the
 * encoding happens on a media engine that is not the GPU.
 *
 * The one thing this must never do is show a zero. A card whose encoder cannot
 * be read is not a card sitting idle, and a pane that cannot tell the
 * difference would have an operator hunting a fault that is not there.
 */
const describeGraphics = (graphics: Monitor['resources']['graphics']): Omit<Stat, 'label'> => {
  if (graphics === null) {
    return { value: '—', detail: 'No card Flux can read' };
  }

  if (graphics.encoderPercent !== null) {
    return {
      value: `${graphics.encoderPercent.toFixed(0)}%`,
      fraction: graphics.encoderPercent / 100,
      detail: `encoder · ${graphics.name}`,
    };
  }

  if (graphics.devicePercent !== null) {
    return {
      value: `${graphics.devicePercent.toFixed(0)}%`,
      fraction: graphics.devicePercent / 100,
      detail: 'whole card · encoder not readable',
    };
  }

  return { value: '—', detail: `${graphics.name} · nothing readable` };
};

export { describeGraphics };
