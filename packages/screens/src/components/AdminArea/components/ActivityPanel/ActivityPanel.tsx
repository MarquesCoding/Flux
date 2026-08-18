import { useState } from 'react';
import { SessionCard } from '@FluxScreens/components/AdminArea/components/SessionCard/SessionCard';
import { SessionMessageDialog } from '@FluxScreens/components/AdminArea/components/SessionMessageDialog/SessionMessageDialog';
import { groupSessionsByViewer } from '@FluxScreens/components/AdminArea/groupSessionsByViewer';
import { Card } from '@FluxUI/Card';
import { CardHeader } from '@FluxUI/CardHeader';
import type { ActivityPanelProps } from './ActivityPanel.types';

/**
 * Who has the app open, what they are watching, and how well it is going for them — grouped by viewer
 * rather than listed flat, since one person with several tabs open is one person. Carries the
 * controls for intervening: stopping a session outright, or pausing it with a reason the viewer will
 * be shown.
 *
 * @param sessions - Every session open at the moment.
 * @param busyClientId - The session an instruction is in flight for, if any.
 * @param onStop - Called with the session to stop.
 * @param onPause - Called with the session to pause.
 * @param onResume - Called with the session to let carry on.
 * @param onMessage - Called with the session to tell something, and what to tell it.
 * @returns The panel.
 */
const ActivityPanel = ({
  sessions,
  busyClientId,
  onStop,
  onPause,
  onResume,
  onMessage,
}: ActivityPanelProps) => {
  const [messaging, setMessaging] = useState<string | null>(null);

  const watcher = sessions.find((session) => session.clientId === messaging);

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
                    onMessage={() => {
                      setMessaging(session.clientId);
                    }}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      <SessionMessageDialog
        watcher={watcher?.profileName ?? watcher?.deviceLabel ?? 'this screen'}
        isOpen={watcher !== undefined}
        onSend={async (text) => {
          if (watcher !== undefined) {
            await onMessage(watcher.clientId, text);
          }
        }}
        onClose={() => {
          setMessaging(null);
        }}
      />
    </Card>
  );
};

ActivityPanel.displayName = 'ActivityPanel';

export { ActivityPanel };
