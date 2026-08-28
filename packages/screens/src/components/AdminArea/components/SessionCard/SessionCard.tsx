import { Icon } from '@ValenceUI/Icon';
import {
  ChatCircleIcon,
  InfoIcon,
  PauseIcon,
  PlayIcon,
  StopIcon,
  TelevisionIcon,
} from '@phosphor-icons/react';
import { useState } from 'react';
import { Badge } from '@ValenceUI/Badge';
import { Button } from '@ValenceUI/Button';
import { Card } from '@ValenceUI/Card';
import { formatDuration } from '@ValenceCore/functions/formatDuration';
import { deviceIconFor } from './deviceIcon';
import { SessionStatsDialog } from '@ValenceScreens/components/AdminArea/components/SessionStatsDialog/SessionStatsDialog';
import type { SessionCardProps } from './SessionCard.types';

/**
 * One open session: who has it, on what device, what they are watching, how far through they are, and
 * how the stream is faring. Carries the controls for intervening in it, and a way through to
 * everything the server knows about the stream for anybody asking why it is struggling.
 *
 * @param session - The session.
 * @param isBusy - Whether an instruction for it is in flight.
 * @param onStop - Called to stop it.
 * @param onPause - Called to pause it.
 * @param onResume - Called to let it carry on.
 * @param onMessage - Called to tell the viewer something, without touching their playback.
 */
const SessionCard = ({
  session,
  isBusy,
  onStop,
  onPause,
  onResume,
  onMessage,
}: SessionCardProps) => {
  const { playback } = session;
  const deviceGlyph = deviceIconFor(session.deviceLabel);
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
          <Icon of={TelevisionIcon} size={20} className="text-text-muted" />
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

          {playback === null ||
          (playback.reuse !== 'whole' && playback.reuse !== 'shared') ? null : (
            <Badge size="sm" tone="success">
              {playback.reuse === 'whole' ? 'Cached' : 'Shared'}
            </Badge>
          )}
        </span>

        <span className="flex min-w-0 items-center gap-1.5 text-xs text-text-muted">
          <Icon of={deviceGlyph} size={14} className="shrink-0" />
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
                className="absolute inset-y-0 left-0 rounded-full bg-primary"
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
                <Icon of={PauseIcon} size={15} />
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
                <Icon of={PlayIcon} size={15} />
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
              <Icon of={StopIcon} size={15} />
            </Button>

            <Button
              isIconOnly
              variant="ghost"
              label="Message"
              size="sm"
              disabled={isBusy}
              onClick={onMessage}
            >
              <Icon of={ChatCircleIcon} size={15} />
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
          <Icon of={InfoIcon} size={15} />
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
