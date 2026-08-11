import { Button } from '@FluxUI/Button';
import { IconX } from '@tabler/icons-react';
import { formatDuration } from '@FluxCore/functions/formatDuration';
import type { AudioDecision, VideoDecision } from '@FluxContracts/schemas/PlaybackPlan';
import type { StreamStatsProps } from './StreamStats.types';

/**
 * Rounds a number of seconds for display without pretending to precision.
 */
const seconds = (value: number): string => `${value.toFixed(1)}s`;

/**
 * Reads a plan axis as the decision plus the reason behind it.
 */
const axis = (kind: string, detail: string): string => `${kind} — ${detail}`;

/**
 * Reads the video axis with the resolution/bitrate ceiling actually being
 * encoded to, when it is transcoding.
 *
 * `plan.video` already carries these numbers whether the transcode came from
 * device capability or a chosen quality step; this is the only place they
 * were not already shown.
 */
const videoAxis = (video: VideoDecision): string =>
  video.kind === 'passthrough'
    ? axis(video.kind, video.reason.detail)
    : `${axis(video.kind, video.reason.detail)} (${video.maxWidth.toString()}x${video.maxHeight.toString()} @ ${video.maxBitrateKbps.toString()}kbps)`;

const audioAxis = (audio: AudioDecision): string =>
  audio.kind === 'passthrough'
    ? axis(audio.kind, audio.reason.detail)
    : `${axis(audio.kind, audio.reason.detail)} (${audio.maxBitrateKbps.toString()}kbps)`;

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
 * Everything Flux knows about what is on screen.
 *
 * The negotiator already records why it chose every treatment, and the media
 * element already knows what it is managing to decode. Neither is any use
 * locked inside a log file on the server, so this puts both in front of the
 * person watching.
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
      // The same glass as the bar and the settings panel. These are notes
      // laid over a film, not a console pasted onto one.
      className="flux-glass pointer-events-auto max-h-full w-full max-w-lg overflow-y-auto rounded-2xl p-4 text-xs text-white"
    >
      <header className="mb-3 flex items-center justify-between gap-4 border-b border-white/10 pb-2">
        <h3 className="text-sm font-medium tracking-tight">Stats for nerds</h3>

        <Button isIconOnly variant="ghost" label="Close stats" size="sm" onClick={onClose}>
          <IconX size={16} aria-hidden />
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
