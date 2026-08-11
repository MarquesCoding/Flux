import { useState } from 'react'
import {
  IconDeviceTvFilled,
  IconInfoCircleFilled,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerStop,
} from '@tabler/icons-react'
import IconButtonModule from '@FluxUI/IconButton'
import deviceIconModule from './deviceIcon'
import SessionStatsDialogModule from '@FluxWeb/components/AdminArea/components/SessionStatsDialog/SessionStatsDialog'
import type { SessionCardProps } from './SessionCard.types'

const { IconButton } = IconButtonModule
const { deviceIconFor } = deviceIconModule
const { SessionStatsDialog } = SessionStatsDialogModule

/**
 * One open tab, styled after Jellyfin's session cards: artwork with the
 * device and what's playing laid over it, and a row of transport controls
 * underneath.
 *
 * Every open tab gets a card, watching something or not — that is the whole
 * point of presence over the old transcoder-session list, which only ever
 * saw a fraction of who was actually around.
 */
const SessionCard = ({ session, isBusy, onStop, onPause, onResume }: SessionCardProps) => {
  const { playback } = session
  const DeviceIcon = deviceIconFor(session.deviceLabel)
  const [isShowingStats, setIsShowingStats] = useState(false)

  return (
    <article className="flex w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="relative aspect-video w-full overflow-hidden bg-black/40">
        {playback !== null && (playback.hasBackdrop || playback.hasPoster) ? (
          <img
            src={`/api/media/${playback.mediaId}/image/${playback.hasBackdrop ? 'backdrop' : 'poster'}`}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <IconDeviceTvFilled size={28} className="text-text-muted" aria-hidden />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/40" />

        <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 p-2.5">
          <DeviceIcon size={18} className="shrink-0 text-white" aria-hidden />
          <span className="truncate text-xs font-medium text-white/80" title={session.deviceLabel}>
            {session.deviceLabel}
          </span>
        </div>

        {playback === null ? null : (
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-white" title={playback.mediaTitle}>
                {playback.mediaTitle}
              </span>
              <span className="truncate text-xs text-white/70">
                {playback.mode === 'transcode' ? 'Transcoding' : 'Direct play'}
              </span>
            </div>

            <span className="shrink-0 text-xs text-white/70">
              {playback.isPlaying ? 'Playing' : 'Paused'}
            </span>
          </div>
        )}
      </div>

      {playback !== null && playback.health !== null && playback.health.durationSeconds > 0 ? (
        // Buffer drawn first and wider, position drawn over it — the same
        // layering Jellyfin's own session cards use, so how far ahead the
        // transcode is stays visible even while paused.
        <div className="relative h-1 w-full bg-white/10">
          <div
            className="absolute inset-y-0 left-0 bg-white/30"
            style={{
              width: `${(
                Math.min(
                  (playback.health.positionSeconds + playback.health.bufferedAheadSeconds) /
                    playback.health.durationSeconds,
                  1,
                ) * 100
              ).toString()}%`,
            }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-accent"
            style={{
              width: `${(
                Math.min(playback.health.positionSeconds / playback.health.durationSeconds, 1) * 100
              ).toString()}%`,
            }}
          />
        </div>
      ) : null}

      {playback === null ? (
        <div className="flex min-h-11 items-center justify-center px-3">
          <p className="text-center text-xs text-text-muted">Not watching anything</p>
        </div>
      ) : (
        <div className="relative flex min-h-11 items-center justify-center gap-1 border-t border-white/10 bg-black/20 px-2 py-1.5">
          {/* Follows whether it is actually playing, not just whether an
              admin was the one who paused it — a viewer pausing themselves
              should turn this into a working play button too. */}
          {playback.isPlaying ? (
            <IconButton label="Pause" size="sm" disabled={isBusy} onClick={onPause}>
              <IconPlayerPause size={16} aria-hidden />
            </IconButton>
          ) : (
            <IconButton label="Play" size="sm" disabled={isBusy} onClick={onResume}>
              <IconPlayerPlay size={16} aria-hidden />
            </IconButton>
          )}

          <IconButton label="Stop" size="sm" disabled={isBusy} onClick={onStop}>
            <IconPlayerStop size={16} aria-hidden />
          </IconButton>

          {/* Positioned out of the centering flow rather than as a flex
              sibling, so it does not pull the transport controls off centre. */}
          <IconButton
            label="Stream stats"
            size="sm"
            className="absolute right-2"
            onClick={() => {
              setIsShowingStats(true)
            }}
          >
            <IconInfoCircleFilled size={16} aria-hidden />
          </IconButton>
        </div>
      )}

      <SessionStatsDialog
        session={session}
        isOpen={isShowingStats}
        onClose={() => {
          setIsShowingStats(false)
        }}
      />
    </article>
  )
}

SessionCard.displayName = 'SessionCard'

export default { SessionCard }
