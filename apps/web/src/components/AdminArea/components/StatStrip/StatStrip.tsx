import { StatTile } from '@FluxUI/StatTile';
import type { StatStripProps } from './StatStrip.types';

/**
 * The figures that stay on screen whatever else is being read.
 *
 * One row of tiles, each the same shape as every other figure in Flux, because
 * this strip used to draw its own and drifted from them. What it decides is
 * the layout — six across, three on a tablet, two on a narrow window, so the
 * row always divides evenly — and nothing about how a number looks.
 */
const StatStrip = ({ stats }: StatStripProps) => (
  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
    {stats.map((stat) => (
      <StatTile
        key={stat.label}
        label={stat.label}
        value={stat.value}
        {...(stat.detail === undefined ? {} : { detail: stat.detail })}
        {...(stat.fraction === undefined ? {} : { fraction: stat.fraction })}
      />
    ))}
  </dl>
);

StatStrip.displayName = 'StatStrip';

export { StatStrip };
