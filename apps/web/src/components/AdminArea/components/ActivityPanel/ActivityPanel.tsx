import { SessionCard } from '@FluxWeb/components/AdminArea/components/SessionCard/SessionCard';
import { groupSessionsByViewer } from '@FluxWeb/components/AdminArea/groupSessionsByViewer';
import { Card } from '@FluxUI/Card';
import { CardHeader } from '@FluxUI/CardHeader';
import type { ActivityPanelProps } from './ActivityPanel.types';

/**
 * Who has the app open, and what they are watching.
 *
 * The readings that used to sit above this live on the overview, where the
 * rest of the figures are. A page about people should be about people.
 *
 * The list is pushed rather than polled, so it changes the moment somebody
 * arrives or presses play instead of up to five seconds later.
 */
const ActivityPanel = ({
  sessions,
  busyClientId,
  onStop,
  onPause,
  onResume,
  onMessage,
}: ActivityPanelProps) => {
  return (
    <Card as="section" padding="none" className="flex flex-col">
      <CardHeader title="Active sessions">
        <span className="flex items-center gap-1.5 text-xs text-text-muted">
          <span aria-hidden className="size-1.5 rounded-full bg-accent" />
          Live
        </span>
      </CardHeader>

      <div className="flex flex-col gap-4 p-4">
        {sessions.length === 0 ? (
          <p className="text-sm text-text-muted">Nobody has the app open right now.</p>
        ) : (
          groupSessionsByViewer(sessions).map((group) => (
            <div key={group.key} className="flex flex-col gap-2">
              <h3 className="text-xs uppercase tracking-[0.14em] text-text-muted">{group.label}</h3>

              <div className="flex flex-col gap-2">
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
                    onMessage={(text) => {
                      onMessage(session.clientId, text);
                    }}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};

ActivityPanel.displayName = 'ActivityPanel';

export { ActivityPanel };
