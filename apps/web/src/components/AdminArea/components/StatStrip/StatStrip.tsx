import type { StatStripProps } from './StatStrip.types'

/**
 * The figures that stay on screen whatever else is being read.
 *
 * One row, evenly divided, with rules between rather than gaps around: a strip
 * reads as one instrument where four separate cards read as four unrelated
 * facts. These are the numbers somebody keeps half an eye on while looking at
 * something else, so they never scroll away.
 */
const StatStrip = ({ stats }: StatStripProps) => (
  <dl className="grid grid-cols-2 divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] sm:grid-cols-4 sm:divide-x">
    {stats.map((stat) => (
      <div key={stat.label} className="flex flex-col gap-2 p-4 sm:p-5">
        <dt className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-text-muted">
          {stat.icon}
          {stat.label}
        </dt>

        <dd className="flex flex-col gap-2">
          <span className="text-2xl font-semibold tabular-nums leading-none text-text sm:text-3xl">
            {stat.value}
          </span>

          {stat.fraction === undefined ? null : (
            <span className="block h-1 overflow-hidden rounded-full bg-white/10">
              <span
                role="presentation"
                style={{ width: `${(Math.min(Math.max(stat.fraction, 0), 1) * 100).toString()}%` }}
                className="block h-full rounded-full bg-accent transition-[width] duration-500"
              />
            </span>
          )}

          {stat.detail === undefined ? null : (
            <span className="text-xs text-text-muted">{stat.detail}</span>
          )}
        </dd>
      </div>
    ))}
  </dl>
)

StatStrip.displayName = 'StatStrip'

export default { StatStrip }
