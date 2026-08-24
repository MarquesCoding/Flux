import { useState } from 'react';
import { CloudSlashIcon, HardDrivesIcon, WifiHighIcon } from '@phosphor-icons/react';
import { Badge } from '@ValenceUI/Badge';
import { Button } from '@ValenceUI/Button';
import { Icon } from '@ValenceUI/Icon';
import { Logo } from '@ValenceUI/Logo';
import { useHeldFiles } from '@ValenceClient/downloads/useHeldFiles';
import { useOfflineMode } from '@ValenceClient/offline/useOfflineMode';
import { dropAFile, pauseAFile } from '@ValenceClient/downloads/keepingFiles';
import { rememberWatchedOffline, watchedOffline } from '@ValenceClient/offline/watchedOffline';
import { OfflinePlayer } from '@ValenceScreens/components/OfflinePlayer/OfflinePlayer';
import { OfflineShelf } from '@ValenceScreens/components/OfflineShelf/OfflineShelf';
import {
  askForADifferentServer,
  isTheDesktopClient,
} from '@ValenceScreens/desktop/theDesktopShell';
import type { OfflineAppProps } from './OfflineApp.types';

/**
 * Valence with no server: what is on this machine, and something to play it with.
 *
 * A deliberately smaller application rather than the ordinary one with its failures hidden. Nothing
 * here asks the server anything, because there is nothing to ask — no library, no search, no
 * account, no admin, no other profiles. Every one of those would have to be either faked from a
 * stale cache or drawn as an apology, and a screen that half-works is a worse thing to hand somebody
 * than one that was never offered.
 *
 * Going back is always offered where the server is answering again, and never taken automatically
 * from somebody who asked to be offline. Somebody who went offline on purpose an hour before a
 * flight has not changed their mind by walking past a working connection.
 *
 * Where somebody got to is remembered here and picked up from here, because there is nowhere else to
 * remember it. Watching half of something, closing the lid and opening it again is the ordinary way
 * a film gets watched on a journey, and the server that would usually keep the bookmark is the one
 * thing that is missing.
 *
 * @param title - What this instance is called.
 */
const OfflineApp = ({ title }: OfflineAppProps) => {
  const held = useHeldFiles();
  const { isReachable, isByChoice, goOffline } = useOfflineMode();

  const [watching, setWatching] = useState<string | null>(null);

  const playing = held.find((file) => file.downloadId === watching) ?? null;

  if (playing !== null) {
    const gotTo = watchedOffline().find((entry) => entry.mediaId === playing.mediaId);

    return (
      <OfflinePlayer
        file={playing}
        {...(gotTo === undefined ? {} : { startAtSeconds: gotTo.positionSeconds })}
        onLeave={() => {
          setWatching(null);
        }}
        onProgress={(positionSeconds, durationSeconds) => {
          rememberWatchedOffline(playing.mediaId, positionSeconds, durationSeconds);
        }}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo size={28} />

          <div className="flex flex-col">
            <h1 className="font-body text-lg text-text">{title}</h1>

            <p className="font-body text-xs text-text-muted">
              {isReachable
                ? 'Offline because you asked. Only what is on this device is shown.'
                : 'Valence is not reachable. Only what is on this device is shown.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge size="sm" tone="quiet">
            <Icon of={CloudSlashIcon} size={14} />
            Offline
          </Badge>

          {!isTheDesktopClient() ? null : (
            <Button
              variant={isReachable ? 'ghost' : 'primary'}
              size="sm"
              isPill
              onClick={askForADifferentServer}
            >
              <Icon of={HardDrivesIcon} size={15} />
              Change server
            </Button>
          )}

          {!isReachable ? null : (
            <Button
              variant="soft"
              size="sm"
              isPill
              onClick={() => {
                goOffline(false);
              }}
            >
              <Icon of={WifiHighIcon} size={15} />
              {isByChoice ? 'Go back online' : 'Reconnect'}
            </Button>
          )}
        </div>
      </header>

      <OfflineShelf
        held={held}
        onWatch={(file) => {
          setWatching(file.downloadId);
        }}
        onDrop={(file) => {
          void dropAFile(file.downloadId);
        }}
        onPause={(file, isPaused) => {
          void pauseAFile(file.downloadId, isPaused);
        }}
      />
    </main>
  );
};

OfflineApp.displayName = 'OfflineApp';

export { OfflineApp };
