import { RiCloseLine } from '@remixicon/react';
import { Button } from '@FluxUI/Button';
import { formatDuration } from '@FluxCore/functions/formatDuration';
import {
  describeAxis as axis,
  describeVideoAxis as videoAxis,
  describeAudioAxis as audioAxis,
} from '@FluxCore/functions/describePlaybackAxis';
import type { StreamStatsProps } from './StreamStats.types';

/**
 * Rounds a number of seconds for the statistics panel, to one decimal place — buffer and encode
 * figures move constantly, and more digits than that read as noise rather than as detail.
 *
 * @param value - The number of seconds.
 * @returns It, rounded, with its unit.
 */
const seconds = (value: number): string => `${value.toFixed(1)}s`;

type RowProps = {
  name: string;
  children: string;
};

const Row = ({ name, children }: RowProps) => (
  <div className="flex gap-3 rounded-md px-1 py-1 transition-colors hover:bg-white/5">
    <dt className="w-40 shrink-0 text-white/50">{name}</dt>
    <dd className="min-w-0 break-words font-medium tabular-nums text-white">{children}</dd>
  </div>
);

Row.displayName = 'Row';

/**
 * Everything Flux knows about what is on screen and how it got there: what the file is, what the
 * session did to it, how the machine is coping, and how far ahead the buffer runs. For anybody
 * working out why a stream looks or behaves as it does, which is a different question from anything
 * the ordinary controls answer.
 *
 * @param positionSeconds - Where the viewer is.
 * @param bufferedAheadSeconds - How much is ready beyond that.
 * @param encodedSeconds - How far the transcoder has got, where one is running.
 * @param droppedFrames - Frames the browser gave up on, where it reports them.
 * @param decodedFrames - Frames it decoded, where it reports them.
 * @param presentedWidth - How wide the picture is being drawn.
 * @param presentedHeight - How tall it is being drawn.
 * @param media - What is playing.
 * @param session - The session serving it, where one was started.
 * @param detail - What the catalogue holds about the item.
 * @param health - How the stream is faring.
 * @param sessionStartSeconds - Where the session itself began, which is not always where the viewer
 *   is now.
 * @param onClose - Called to close the panel.
 */
const StreamStats = ({
  media,
  session,
  detail,
  health,
  sessionStartSeconds,
  onClose,
}: StreamStatsProps) => {
  const video = detail?.videoCodec ?? media.id;
  const audio = detail?.audioStreams[0] ?? null;
  const plan = session?.plan ?? null;

  return (
    <section
      aria-label="Stats for nerds"
      className="flux-glass pointer-events-auto max-h-full w-full max-w-lg overflow-y-auto rounded-2xl p-4 text-xs text-white"
    >
      <header className="mb-3 flex items-center justify-between gap-4 border-b border-white/10 pb-2">
        <h3 className="text-sm font-medium tracking-tight">Stats for nerds</h3>

        <Button isIconOnly variant="ghost" label="Close stats" size="sm" onClick={onClose}>
          <RiCloseLine size={16} aria-hidden />
        </Button>
      </header>

      <dl className="flex flex-col">
        <Row name="Title">{media.title}</Row>
        <Row name="Media id">{media.id}</Row>
        <Row name="Session">{session?.sessionId ?? 'not started'}</Row>
        <Row name="Mode">{session?.mode ?? 'deciding'}</Row>
        <Row name="Delivery">
          {session === null
            ? 'none'
            : session.delivery.kind === 'hls'
              ? `HLS — ${session.delivery.manifestUrl}`
              : `Direct — ${session.delivery.url}`}
        </Row>
        <Row name="Session starts at">{formatDuration(sessionStartSeconds)}</Row>

        <Row name="Source video">
          {detail === null
            ? 'unknown'
            : `${video} ${media.durationSeconds > 0 ? '' : ''}${detail.width}x${detail.height} ${detail.videoRange}`}
        </Row>
        <Row name="Source audio">
          {audio === null ? 'none' : `${audio.codec} ${audio.channels}ch ${audio.language ?? ''}`}
        </Row>
        <Row name="Subtitles">
          {detail === null || detail.subtitleStreams.length === 0
            ? 'none'
            : `${detail.subtitleStreams.length.toString()} tracks, first ${detail.subtitleStreams[0]?.format ?? ''}`}
        </Row>

        <Row name="Container plan">
          {plan === null ? 'deciding' : axis(plan.container.kind, plan.container.reason.detail)}
        </Row>
        <Row name="Video plan">{plan === null ? 'deciding' : videoAxis(plan.video)}</Row>
        <Row name="Audio plan">{plan === null ? 'deciding' : audioAxis(plan.audio)}</Row>
        <Row name="Subtitle plan">
          {plan === null ? 'deciding' : axis(plan.subtitles.kind, plan.subtitles.reason.detail)}
        </Row>

        <Row name="Position">{formatDuration(health.positionSeconds)}</Row>
        <Row name="Buffered ahead">{seconds(health.bufferedAheadSeconds)}</Row>
        <Row name="Encoded so far">{seconds(health.encodedSeconds)}</Row>
        <Row name="Presented size">
          {health.presentedWidth === 0
            ? 'nothing decoded yet'
            : `${health.presentedWidth.toString()}x${health.presentedHeight.toString()}`}
        </Row>
        <Row name="Frames dropped">
          {health.droppedFrames === null || health.decodedFrames === null
            ? 'not reported'
            : `${health.droppedFrames.toString()} of ${health.decodedFrames.toString()}`}
        </Row>

        {session === null || session.warnings.length === 0 ? null : (
          <Row name="Warnings">{session.warnings.join(' · ')}</Row>
        )}
      </dl>
    </section>
  );
};

StreamStats.displayName = 'StreamStats';

export { StreamStats };
