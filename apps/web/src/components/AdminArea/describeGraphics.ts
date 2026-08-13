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
 *
 * Every detail here fits the one line a tile has for it. A second line pushes
 * the figure and its bar up out of step with the tiles beside it, and a strip
 * read by glancing along the numbers depends on them sitting level. The fuller
 * wording lives in the Server region, which has room for a sentence.
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
