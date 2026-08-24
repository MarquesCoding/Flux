import { CloudSlashIcon, PauseIcon, PlayIcon, TrashIcon } from '@phosphor-icons/react';
import { Badge } from '@ValenceUI/Badge';
import { Button } from '@ValenceUI/Button';
import { Icon } from '@ValenceUI/Icon';
import { ProgressBar } from '@ValenceUI/ProgressBar';
import { SettingList } from '@ValenceUI/SettingList';
import { SettingRow } from '@ValenceUI/SettingRow';
import { describeKeeping, keptFraction } from '@ValenceCore/functions/describeKeeping';
import { posterForAFile } from '@ValenceClient/downloads/keepingFiles';
import type { HeldFile } from '@ValenceContracts/schemas/HeldFile';
import type { OfflineShelfProps } from './OfflineShelf.types';

/**
 * Gathers what is on the disk under the programme each thing belongs to.
 *
 * A season fetched in one press is one thing somebody did, and reading it as thirteen unrelated rows
 * makes it impossible to see at a glance whether the whole thing is here — which is the only
 * question worth asking of a shelf somebody is about to fly with.
 *
 * @param held - Everything on this device.
 * @returns The groups, films first and under no title, then each programme.
 */
const byProgramme = (held: HeldFile[]): { title: string | null; items: HeldFile[] }[] => {
  const groups = new Map<string, HeldFile[]>();

  for (const file of held) {
    const under = file.seriesTitle ?? '';

    groups.set(under, [...(groups.get(under) ?? []), file]);
  }

  return [...groups.entries()]
    .sort(([one], [other]) => one.localeCompare(other))
    .map(([title, items]) => ({ title: title === '' ? null : title, items }));
};

/**
 * What is actually on this machine, which offline is the whole of.
 *
 * Everything here can be played with nothing switched on, and that is the only promise the screen
 * makes. Something still arriving is shown arriving rather than hidden, because somebody who closed
 * the lid halfway through a transfer is owed the sight of where it got to — and because a shelf that
 * silently omitted it would look like the download had been lost.
 *
 * @param held - Everything on this device.
 * @param onWatch - Told which one to play.
 * @param onDrop - Told to let go of one.
 * @param onPause - Told to stop a transfer for now, or to carry on with it.
 */
const OfflineShelf = ({ held, onWatch, onDrop, onPause }: OfflineShelfProps) => {
  if (held.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <Icon of={CloudSlashIcon} size={32} className="text-text-muted" />

        <h2 className="font-body text-base text-text">Nothing is on this device</h2>

        <p className="max-w-sm font-body text-sm text-text-muted">
          Downloads are fetched here while Valence is reachable. Once the server is back, ask for
          something from its page and it will be waiting the next time you are offline.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {byProgramme(held).map((group) => (
        <section key={group.title ?? 'films'} className="flex flex-col">
          {group.title === null ? null : (
            <header className="flex items-baseline justify-between gap-3 px-5 pb-2 pt-5">
              <h3 className="text-xs uppercase tracking-[0.16em] text-text-muted">{group.title}</h3>

              <span className="font-body text-xs text-text-muted">
                {group.items.filter((one) => one.state === 'here').length.toString()} of{' '}
                {group.items.length.toString()} ready
              </span>
            </header>
          )}

          <SettingList>
            {group.items.map((file) => (
              <SettingRow
                key={file.downloadId}
                title={file.title}
                description={describeKeeping(file)}
                icon={
                  <span className="block aspect-[2/3] w-9 shrink-0 overflow-hidden rounded-md bg-surface-raised ring-1 ring-line">
                    {!file.hasPoster ? null : (
                      <img
                        src={posterForAFile(file.downloadId)}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </span>
                }
              >
                <Badge size="sm" tone={file.state === 'failed' ? 'danger' : 'quiet'}>
                  {file.quality}
                </Badge>

                {file.state !== 'fetching' ? null : (
                  <ProgressBar
                    value={keptFraction(file) ?? 0}
                    max={1}
                    label={`Fetching ${file.title}`}
                    className="w-28"
                  />
                )}

                {file.state !== 'here' ? null : (
                  <Button
                    variant="soft"
                    size="sm"
                    isPill
                    onClick={() => {
                      onWatch(file);
                    }}
                  >
                    <Icon of={PlayIcon} size={15} />
                    Watch
                  </Button>
                )}

                {file.state !== 'fetching' && file.state !== 'paused' ? null : (
                  <Button
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    isPill
                    label={
                      file.state === 'paused'
                        ? `Carry on fetching ${file.title}`
                        : `Stop fetching ${file.title} for now`
                    }
                    onClick={() => {
                      onPause(file, file.state !== 'paused');
                    }}
                  >
                    <Icon of={file.state === 'paused' ? PlayIcon : PauseIcon} size={16} />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  isIconOnly
                  isPill
                  label={`Remove ${file.title} from this device`}
                  onClick={() => {
                    onDrop(file);
                  }}
                >
                  <Icon of={TrashIcon} size={16} />
                </Button>
              </SettingRow>
            ))}
          </SettingList>
        </section>
      ))}
    </div>
  );
};

OfflineShelf.displayName = 'OfflineShelf';

export { OfflineShelf, byProgramme };
