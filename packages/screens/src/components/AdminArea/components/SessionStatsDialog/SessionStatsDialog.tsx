import { Icon } from '@ValenceUI/Icon';
import { XIcon } from '@phosphor-icons/react';
import { Dialog } from '@ValenceUI/Dialog';
import { DialogContent } from '@ValenceUI/DialogContent';
import { DialogTitle } from '@ValenceUI/DialogTitle';
import { Button } from '@ValenceUI/Button';
import {
  describeAxis,
  describeVideoAxis,
  describeAudioAxis,
} from '@ValenceCore/functions/describePlaybackAxis';
import type { SessionStatsDialogProps } from './SessionStatsDialog.types';

type RowProps = {
  name: string;
  children: string;
};

/**
 * One labelled fact in the statistics list, laid out so the labels line up down the column and long
 * values wrap rather than pushing the layout wide.
 *
 * @param name - What the fact is.
 * @param children - The fact itself.
 */
const Row = ({ name, children }: RowProps) => (
  <div className="flex gap-3 rounded-md px-1 py-1.5 text-sm">
    <dt className="w-32 shrink-0 text-text-muted">{name}</dt>
    <dd className="min-w-0 break-words font-medium text-text">{children}</dd>
  </div>
);

Row.displayName = 'Row';

/**
 * Everything the server knows about one session's stream, shown to an administrator rather than to
 * the viewer: what the file is, what the session is doing to it, how the machine is coping with it,
 * and how much the viewer has buffered. The answer to "why does this one look bad".
 *
 * @param session - The session being examined.
 * @param isOpen - Whether the dialog is showing.
 * @param onClose - Called when it is dismissed.
 */
const SessionStatsDialog = ({ session, isOpen, onClose }: SessionStatsDialogProps) => {
  const { playback } = session;

  return (
    <Dialog label="Stream stats" isOpen={isOpen} onClose={onClose}>
      <DialogTitle title="Stream stats">
        <Button isIconOnly variant="ghost" label="Close" size="sm" onClick={onClose}>
          <Icon of={XIcon} size={16} />
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
