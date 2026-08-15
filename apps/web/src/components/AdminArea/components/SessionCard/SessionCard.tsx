import { useState } from 'react';
import { RiInformationLine, RiPauseLine, RiPlayLine, RiStopLine, RiTvFill } from '@remixicon/react';
import { Badge } from '@FluxUI/Badge';
import { Button } from '@FluxUI/Button';
import { Card } from '@FluxUI/Card';
import { formatDuration } from '@FluxCore/functions/formatDuration';
import { deviceIconFor } from './deviceIcon';
import { SessionStatsDialog } from '@FluxWeb/components/AdminArea/components/SessionStatsDialog/SessionStatsDialog';
import type { SessionCardProps } from './SessionCard.types';

/**
 * One open tab, across rather than down.
 */
const SessionCard = ({ session, isBusy, onStop, onPause, onResume }: SessionCardProps) => {
  const { playback } = session;
  const DeviceIcon = deviceIconFor(session.deviceLabel);
  const [isShowingStats, setIsShowingStats] = useState(false);

  const health = playback?.health ?? null;
  const hasProgress = health !== null && health.durationSeconds > 0;

  return (
    <Card as="article" padding="sm" radius="md" className="flex w-full min-w-0 items-center gap-3">
      <span className="relative flex aspect-video w-24 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-[var(--surface-hover)]">
        {playback !== null && (playback.hasBackdrop || playback.hasPoster) ? (
          <img
            src={`/api/media/${playback.mediaId}/image/${playback.hasBackdrop ? 'backdrop' : 'poster'}`}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <RiTvFill size={20} className="text-text-muted" aria-hidden />
        )}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-text">
            {playback?.mediaTitle ?? 'Not watching anything'}
          </span>

          {playback === null ? null : (
            <Badge size="sm" tone={playback.mode === 'transcode' ? 'accent' : 'quiet'}>
              {playback.mode === 'transcode' ? 'Transcoding' : 'Direct'}
            </Badge>
          )}
        </span>

        <span className="flex min-w-0 items-center gap-1.5 text-xs text-text-muted">
          <DeviceIcon size={14} className="shrink-0" aria-hidden />
          <span className="truncate" title={session.deviceLabel}>
            {session.deviceLabel}
          </span>

          {playback === null ? null : (
            <span className="shrink-0">· {playback.isPlaying ? 'Playing' : 'Paused'}</span>
          )}
        </span>

        {!hasProgress ? null : (
          <span className="flex items-center gap-2">
            <span className="relative block h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-text/25"
                style={{
                  width: `${(
                    Math.min(
                      (health.positionSeconds + health.bufferedAheadSeconds) /
                        health.durationSeconds,
                      1,
                    ) * 100
                  ).toString()}%`,
                }}
              />

              <span
                role="presentation"
                className="absolute inset-y-0 left-0 rounded-full bg-accent"
                style={{
                  width: `${(
                    Math.min(health.positionSeconds / health.durationSeconds, 1) * 100
                  ).toString()}%`,
                }}
              />
            </span>

            <span className="shrink-0 text-xs tabular-nums text-text-muted">
              {formatDuration(health.positionSeconds)} / {formatDuration(health.durationSeconds)}
            </span>
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {playback === null ? null : (
          <>
            {playback.isPlaying ? (
              <Button
                isIconOnly
                variant="ghost"
                label="Pause"
                size="sm"
                disabled={isBusy}
                onClick={onPause}
              >
                <RiPauseLine size={15} aria-hidden />
              </Button>
            ) : (
              <Button
                isIconOnly
                variant="ghost"
                label="Play"
                size="sm"
                disabled={isBusy}
                onClick={onResume}
              >
                <RiPlayLine size={15} aria-hidden />
              </Button>
            )}

            <Button
              isIconOnly
              variant="ghost"
              label="Stop"
              size="sm"
              disabled={isBusy}
              onClick={onStop}
            >
              <RiStopLine size={15} aria-hidden />
            </Button>
          </>
        )}

        <Button
          isIconOnly
          variant="ghost"
          label="Stream stats"
          size="sm"
          onClick={() => {
            setIsShowingStats(true);
          }}
        >
          <RiInformationLine size={15} aria-hidden />
        </Button>
      </div>

      <SessionStatsDialog
        session={session}
        isOpen={isShowingStats}
        onClose={() => {
          setIsShowingStats(false);
        }}
      />
    </Card>
  );
};

SessionCard.displayName = 'SessionCard';

export { SessionCard };
