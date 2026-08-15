import { RiCloseLine } from '@remixicon/react';
import { Dialog } from '@FluxUI/Dialog';
import { DialogContent } from '@FluxUI/DialogContent';
import { DialogTitle } from '@FluxUI/DialogTitle';
import { Button } from '@FluxUI/Button';
import {
  describeAxis,
  describeVideoAxis,
  describeAudioAxis,
} from '@FluxCore/functions/describePlaybackAxis';
import type { SessionStatsDialogProps } from './SessionStatsDialog.types';

type RowProps = {
  name: string;
  children: string;
};

const Row = ({ name, children }: RowProps) => (
  <div className="flex gap-3 rounded-md px-1 py-1.5 text-sm">
    <dt className="w-32 shrink-0 text-text-muted">{name}</dt>
    <dd className="min-w-0 break-words font-medium text-text">{children}</dd>
  </div>
);

Row.displayName = 'Row';

/**
 * What an admin can see about one tab's stream.
 *
 * Buffer and picture size come from the viewer's own player, carried here on
 * its heartbeat — the server has no way to measure either of those itself.
 * They lag behind by up to one heartbeat interval, and by however long the
 * admin page's own poll takes to catch up after that.
 */
const SessionStatsDialog = ({ session, isOpen, onClose }: SessionStatsDialogProps) => {
  const { playback } = session;

  return (
    <Dialog label="Stream stats" isOpen={isOpen} onClose={onClose}>
      <DialogTitle title="Stream stats">
        <Button isIconOnly variant="ghost" label="Close" size="sm" onClick={onClose}>
          <RiCloseLine size={16} aria-hidden />
        </Button>
      </DialogTitle>

      <DialogContent>
        <dl className="flex flex-col divide-y divide-[var(--surface-line)]">
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
      </DialogContent>
    </Dialog>
  );
};

SessionStatsDialog.displayName = 'SessionStatsDialog';

export { SessionStatsDialog };
