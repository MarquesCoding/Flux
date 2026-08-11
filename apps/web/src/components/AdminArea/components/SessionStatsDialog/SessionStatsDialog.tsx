import { IconX } from '@tabler/icons-react'
import DialogModule from '@FluxUI/Dialog'
import IconButtonModule from '@FluxUI/IconButton'
import describePlaybackAxisModule from '@FluxCore/functions/describePlaybackAxis'
import type { SessionStatsDialogProps } from './SessionStatsDialog.types'

const { Dialog } = DialogModule
const { IconButton } = IconButtonModule
const { describeAxis, describeVideoAxis, describeAudioAxis } = describePlaybackAxisModule

type RowProps = {
  name: string
  children: string
}

const Row = ({ name, children }: RowProps) => (
  <div className="flex gap-3 rounded-md px-1 py-1.5 text-sm">
    <dt className="w-32 shrink-0 text-text-muted">{name}</dt>
    <dd className="min-w-0 break-words font-medium text-text">{children}</dd>
  </div>
)

Row.displayName = 'Row'

/**
 * What an admin can see about one tab's stream.
 *
 * Buffer and picture size come from the viewer's own player, carried here on
 * its heartbeat — the server has no way to measure either of those itself.
 * They lag behind by up to one heartbeat interval, and by however long the
 * admin page's own poll takes to catch up after that.
 */
const SessionStatsDialog = ({ session, isOpen, onClose }: SessionStatsDialogProps) => {
  const { playback } = session

  return (
    <Dialog label="Stream stats" isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col gap-4 p-6">
        <header className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium text-text">Stream stats</h2>

          <IconButton label="Close" size="sm" onClick={onClose}>
            <IconX size={18} aria-hidden />
          </IconButton>
        </header>

        <dl className="flex flex-col divide-y divide-white/5">
          <Row name="Viewer">{session.profileName ?? 'Unknown viewer'}</Row>
          <Row name="Device">{session.deviceLabel}</Row>

          {playback === null ? (
            <Row name="Watching">Nothing right now</Row>
          ) : (
            <>
              <Row name="Title">{playback.mediaTitle}</Row>
              <Row name="Delivery">
                {playback.mode === 'transcode'
                  ? 'Transcoding — the server is converting this on the fly'
                  : 'Direct play — the original file, unconverted'}
              </Row>
              <Row name="Status">
                {playback.isPlaying
                  ? 'Playing'
                  : playback.pausedByAdmin
                    ? 'Paused by an admin'
                    : 'Paused'}
              </Row>
              <Row name="Started">{new Date(playback.startedAt).toLocaleTimeString()}</Row>

              {/* Every axis is negotiated independently, so "transcoding" can
                  mean anything from a plain remux to converting every stream
                  — this is why, axis by axis, in the negotiator's own words. */}
              <Row name="Container">
                {describeAxis(playback.plan.container.kind, playback.plan.container.reason.detail)}
              </Row>
              <Row name="Video">{describeVideoAxis(playback.plan.video)}</Row>
              <Row name="Audio">{describeAudioAxis(playback.plan.audio)}</Row>
              <Row name="Subtitles">
                {describeAxis(playback.plan.subtitles.kind, playback.plan.subtitles.reason.detail)}
              </Row>

              {playback.health === null ? (
                <Row name="Buffer">Not reported yet</Row>
              ) : (
                <>
                  <Row name="Buffer">{`${playback.health.bufferedAheadSeconds.toFixed(1)}s ahead`}</Row>
                  <Row name="Picture size">
                    {playback.health.presentedWidth === 0
                      ? 'Nothing decoded yet'
                      : `${playback.health.presentedWidth.toString()}x${playback.health.presentedHeight.toString()}`}
                  </Row>
                </>
              )}
            </>
          )}
        </dl>
      </div>
    </Dialog>
  )
}

SessionStatsDialog.displayName = 'SessionStatsDialog'

export default { SessionStatsDialog }
