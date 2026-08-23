import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@ValenceUI/Icon';
import { DownloadSimpleIcon, PauseIcon, PlayIcon, TrashIcon } from '@phosphor-icons/react';
import { Badge } from '@ValenceUI/Badge';
import { Button } from '@ValenceUI/Button';
import { CouldNotRead } from '@ValenceUI/CouldNotRead';
import { ProgressBar } from '@ValenceUI/ProgressBar';
import { SettingList } from '@ValenceUI/SettingList';
import { SettingRow } from '@ValenceUI/SettingRow';
import { formatBytes } from '@ValenceCore/functions/formatBytes';
import { forgetDownload, setDownloadPaused } from '@ValenceClient/downloads/fetchDownloads';
import { downloadQueries } from '@ValenceClient/query/downloadQueries';
import type { Download } from '@ValenceContracts/schemas/Download';

/**
 * Says where a prepared file has got to, in the words somebody would use about it.
 *
 * @param download - The download.
 * @returns The line beneath its title.
 */
const describeState = (download: Download): string => {
  const done = `${Math.round(download.progress * 100).toString()}%`;

  if (download.state === 'failed') {
    return download.failure ?? 'That could not be prepared.';
  }

  if (download.state === 'queued') {
    return download.progress > 0 ? `Waiting to carry on from ${done}.` : 'Waiting its turn.';
  }

  if (download.state === 'paused') {
    return `Paused at ${done}. What is done is kept.`;
  }

  if (download.state === 'preparing') {
    return `Preparing — ${done} done.`;
  }

  return download.sizeBytes === null
    ? 'Ready to fetch.'
    : `Ready to fetch — ${formatBytes(download.sizeBytes)}.`;
};

/**
 * Gathers downloads under the programme they belong to, in the order they were asked for.
 *
 * A season queued in one press is one thing somebody did, and reading it as thirteen unrelated rows
 * makes it impossible to see whether the season is nearly done or has barely started.
 *
 * @param downloads - Everything asked for.
 * @returns The groups, each with what to call it.
 */
const groupBySeries = (downloads: Download[]): { title: string | null; items: Download[] }[] => {
  const groups: { title: string | null; items: Download[] }[] = [];

  for (const download of downloads) {
    const title = download.seriesTitle;
    const last = groups.at(-1);

    if (last !== undefined && last.title === title && title !== null) {
      last.items.push(download);

      continue;
    }

    groups.push({ title, items: [download] });
  }

  return groups;
};

/**
 * Everything this viewer has asked the server to prepare, and what became of each.
 *
 * This is the server's side of a download and never the device's. Forgetting one here reclaims the
 * disk the server was holding in case somebody asked again; anything already on a phone stays there
 * until whoever owns the phone deletes it. Valence is not a subscription and has no business taking
 * things back.
 */
const DownloadList = () => {
  const cache = useQueryClient();
  const asked = useQuery(downloadQueries.all());

  const downloads = asked.data ?? [];

  if (asked.isError) {
    return (
      <div className="px-5 py-4">
        <CouldNotRead
          what="Your downloads"
          isTryingAgain={asked.isFetching}
          onTryAgain={() => {
            void asked.refetch();
          }}
        />
      </div>
    );
  }

  if (downloads.length === 0) {
    return (
      <p className="flex items-center gap-2 px-5 py-6 font-body text-sm text-text-muted">
        <Icon of={DownloadSimpleIcon} size={18} />
        Nothing prepared yet. Ask for something from its page and it will appear here.
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {groupBySeries(downloads).map((group) => (
        <section key={group.title ?? group.items[0]?.id} className="flex flex-col">
          {group.title === null ? null : (
            <header className="flex items-baseline justify-between gap-3 px-5 pb-2 pt-5">
              <h3 className="text-xs uppercase tracking-[0.16em] text-text-muted">{group.title}</h3>

              <span className="font-body text-xs text-text-muted">
                {group.items.filter((one) => one.state === 'ready').length.toString()} of{' '}
                {group.items.length.toString()} ready
              </span>
            </header>
          )}

          <SettingList>
            {group.items.map((download) => (
              <SettingRow
                key={download.id}
                title={download.title}
                description={describeState(download)}
              >
                <Badge size="sm" tone={download.state === 'failed' ? 'danger' : 'quiet'}>
                  {download.quality}
                </Badge>

                {download.state !== 'preparing' ? null : (
                  <ProgressBar
                    value={download.progress}
                    label={`Preparing ${download.title}`}
                    className="w-28"
                  />
                )}

                {download.state !== 'ready' ? null : (
                  <Button
                    variant="soft"
                    size="sm"
                    isPill
                    onClick={() => {
                      window.location.assign(`/api/downloads/${download.id}/file`);
                    }}
                  >
                    <Icon of={DownloadSimpleIcon} size={15} />
                    Fetch
                  </Button>
                )}

                {download.state === 'ready' || download.state === 'failed' ? null : (
                  <Button
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    isPill
                    label={
                      download.state === 'paused'
                        ? `Carry on preparing ${download.title}`
                        : `Stop preparing ${download.title} for now`
                    }
                    onClick={() => {
                      void setDownloadPaused(download.id, download.state !== 'paused').then(
                        async () => cache.invalidateQueries({ queryKey: downloadQueries.key }),
                      );
                    }}
                  >
                    {download.state === 'paused' ? (
                      <Icon of={PlayIcon} size={16} />
                    ) : (
                      <Icon of={PauseIcon} size={16} />
                    )}
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  isIconOnly
                  isPill
                  label={`Stop keeping ${download.title} on the server`}
                  onClick={() => {
                    void forgetDownload(download.id).then(async () =>
                      cache.invalidateQueries({ queryKey: downloadQueries.key }),
                    );
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

DownloadList.displayName = 'DownloadList';

export { DownloadList };
