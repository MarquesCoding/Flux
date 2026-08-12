import { IconActivity } from '@tabler/icons-react';
import { Sparkline } from '@FluxUI/Sparkline';
import { SessionCard } from '@FluxWeb/components/AdminArea/components/SessionCard/SessionCard';
import { formatBytes } from '@FluxWeb/components/AdminArea/formatBytes';
import { groupSessionsByViewer } from '@FluxWeb/components/AdminArea/groupSessionsByViewer';
import type { ActivityPanelProps } from './ActivityPanel.types';

/**
 * What the machine is doing this minute, and who is watching.
 *
 * The two belong together: a processor pinned at a hundred percent means one
 * thing when somebody is mid-film and another when nobody has the app open.
 */
const ActivityPanel = ({
  history,
  monitor,
  sessions,
  busyClientId,
  onStop,
  onPause,
  onResume,
}: ActivityPanelProps) => {
  const resources = monitor?.resources ?? null;
  const conversions = resources?.children ?? [];

  return (
    <>
      <div className="grid gap-px bg-white/10 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4 bg-surface/40 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm uppercase tracking-[0.16em] text-text-muted">
              <IconActivity size={14} aria-hidden />
              Last minute
            </h2>

            <span className="text-xs tabular-nums text-text-muted">
              {history.length.toString()} readings
            </span>
          </div>

          <Sparkline
            values={history}
            ceiling={100}
            label="Processor use over the last minute"
            className="h-32"
          />

          <p className="text-xs leading-relaxed text-text-muted">
            A reading a second. A tall run is something being converted; a flat floor is the server
            idling.
          </p>
        </div>

        <div className="flex flex-col gap-3 bg-surface/40 p-5">
          <h2 className="text-sm uppercase tracking-[0.16em] text-text-muted">Conversions</h2>

          {conversions.length === 0 ? (
            <p className="text-sm text-text-muted">Nothing is being converted.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {conversions.map((child) => (
                <li key={child.pid} className="flex flex-col gap-1.5">
                  <span className="flex items-baseline justify-between gap-3 text-sm tabular-nums">
                    <span className="text-text">ffmpeg {child.pid}</span>
                    <span className="text-text-muted">
                      {child.cpuPercent.toFixed(0)}% · {formatBytes(child.memoryBytes)}
                    </span>
                  </span>

                  <span className="block h-1 overflow-hidden rounded-full bg-white/10">
                    <span
                      role="presentation"
                      style={{
                        width: `${Math.min(
                          (child.cpuPercent / Math.max((resources?.cpuCount ?? 1) * 100, 1)) * 100,
                          100,
                        ).toString()}%`,
                      }}
                      className="block h-full rounded-full bg-accent"
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5 border-t border-white/10 bg-surface/40 p-5">
        <h2 className="text-sm uppercase tracking-[0.16em] text-text-muted">Active Sessions</h2>

        {sessions.length === 0 ? (
          <p className="text-sm text-text-muted">Nobody has the app open right now.</p>
        ) : (
          groupSessionsByViewer(sessions).map((group) => (
            <div key={group.key} className="flex flex-col gap-3">
              <h3 className="text-xs font-medium text-text">{group.label}</h3>

              <div className="flex flex-wrap gap-3">
                {group.sessions.map((session) => (
                  <SessionCard
                    key={session.clientId}
                    session={session}
                    isBusy={busyClientId === session.clientId}
                    onStop={() => {
                      onStop(session.clientId);
                    }}
                    onPause={() => {
                      onPause(session.clientId);
                    }}
                    onResume={() => {
                      onResume(session.clientId);
                    }}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
};

ActivityPanel.displayName = 'ActivityPanel';

export { ActivityPanel };
