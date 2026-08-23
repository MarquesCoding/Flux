import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@ValenceUI/Icon';
import { DownloadSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { Badge } from '@ValenceUI/Badge';
import { Button } from '@ValenceUI/Button';
import { CouldNotRead } from '@ValenceUI/CouldNotRead';
import { ProgressBar } from '@ValenceUI/ProgressBar';
import { SettingList } from '@ValenceUI/SettingList';
import { SettingRow } from '@ValenceUI/SettingRow';
import { formatBytes } from '@ValenceCore/functions/formatBytes';
import { forgetDownload } from '@ValenceClient/downloads/fetchDownloads';
import { downloadQueries } from '@ValenceClient/query/downloadQueries';
import type { Download } from '@ValenceContracts/schemas/Download';

/**
 * Says where a prepared file has got to, in the words somebody would use about it.
 *
 * @param download - The download.
 * @returns The line beneath its title.
 */
const describeState = (download: Download): string => {
  if (download.state === 'failed') {
    return download.failure ?? 'That could not be prepared.';
  }

  if (download.state === 'preparing') {
    return `Preparing — ${Math.round(download.progress * 100).toString()}% done.`;
  }

  return download.sizeBytes === null
    ? 'Ready to fetch.'
    : `Ready to fetch — ${formatBytes(download.sizeBytes)}.`;
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
    <SettingList>
      {downloads.map((download) => (
        <SettingRow key={download.id} title={download.title} description={describeState(download)}>
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
  );
};

DownloadList.displayName = 'DownloadList';

export { DownloadList };
