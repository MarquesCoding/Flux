import type { EventsPanelProps } from './EventsPanel.types';

const atTime = (ms: number): string => new Date(ms).toLocaleTimeString();

/**
 * What the server has reported lately.
 *
 * Monospaced and dense on purpose: this is read by somebody scanning for the
 * one line that explains what just went wrong, not by somebody browsing.
 */
const EventsPanel = ({ monitor }: EventsPanelProps) => (
  <div className="flex flex-col">
    <header className="border-b border-white/10 px-6 py-4">
      <h2 className="text-sm uppercase tracking-[0.16em] text-text-muted">Recent events</h2>
    </header>

    {monitor === null || monitor.logs.length === 0 ? (
      <p className="p-6 text-sm text-text-muted">Nothing has been reported.</p>
    ) : (
      <ul className="max-h-96 divide-y divide-white/5 overflow-y-auto font-mono text-xs">
        {monitor.logs.map((line) => (
          <li key={`${line.atMs.toString()}-${line.message}`} className="flex gap-4 px-6 py-2.5">
            <span className="shrink-0 tabular-nums text-text-muted">{atTime(line.atMs)}</span>

            <span
              className={`shrink-0 ${line.level === 'error' ? 'text-danger' : 'text-text-muted'}`}
            >
              {line.source}
            </span>

            <span className="min-w-0 flex-1 text-text">{line.message}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

EventsPanel.displayName = 'EventsPanel';

export { EventsPanel };
