import { StatTile } from '@ValenceUI/StatTile';
import type { StatStripProps } from './StatStrip.types';

/**
 * The figures that stay on screen whatever else is being read, each with what it measures and, where
 * it is a proportion, a bar of how full it is.
 *
 * @param stats - The figures to show, in the order they should read.
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
