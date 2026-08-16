import { useId } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { cn } from '@FluxUI/cn';
import type { TrendChartProps } from './TrendChart.types';

/**
 * Turns a list of readings into the row-per-reading shape the charting library expects, since it
 * takes objects rather than numbers.
 *
 * @param values - The readings, oldest first.
 * @returns One row per reading.
 */
const toRows = (values: number[]): { at: number; value: number }[] =>
  values.map((value, at) => ({ at, value }));

/**
 * Draws one reading over time as a filled line, for figures that only mean something in motion —
 * throughput, sessions, cache size. The ceiling is given rather than taken from the data, so a chart
 * does not rescale itself every time a reading arrives and make a flat line look dramatic.
 *
 * @param values - The readings, oldest first.
 * @param ceiling - The top of the scale.
 * @param label - What is being measured, read out to anybody who cannot see the chart.
 * @param caption - A line beneath it, such as the period covered.
 * @param className - Extra classes for the caller's own layout.
 */
const TrendChart = ({ values, ceiling, label, caption, className }: TrendChartProps) => {
  const fillId = useId();

  if (values.length === 0) {
    return (
      <div className={cn('flex h-20 items-center', className)}>
        <p className="font-body text-xs text-text-muted">Nothing measured yet.</p>
      </div>
    );
  }

  return (
    <figure className={cn('flex flex-col gap-1.5', className)}>
      <div role="img" aria-label={label} className="h-24 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={toRows(values)} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>

            <YAxis hide domain={[0, Math.max(ceiling, 1)]} />

            <Tooltip
              cursor={{ stroke: 'var(--surface-divider)', strokeWidth: 1 }}
              contentStyle={{
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--surface-line)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                padding: '0.25rem 0.5rem',
              }}
              labelFormatter={() => ''}
              formatter={(value) => [typeof value === 'number' ? Math.round(value) : '', '']}
              separator=""
            />

            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--color-accent)"
              strokeWidth={2}
              fill={`url(#${fillId})`}
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: 'var(--color-accent)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {caption === undefined ? null : (
        <figcaption className="font-body text-xs text-text-muted">{caption}</figcaption>
      )}
    </figure>
  );
};

TrendChart.displayName = 'TrendChart';

export { TrendChart };
