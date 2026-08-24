import { Icon } from '@ValenceUI/Icon';
import { XIcon } from '@phosphor-icons/react';
import { Button } from '@ValenceUI/Button';
import { formatDuration } from '@ValenceCore/functions/formatDuration';
import {
  describeAxis as axis,
  describeVideoAxis as videoAxis,
  describeAudioAxis as audioAxis,
} from '@ValenceCore/functions/describePlaybackAxis';
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

/**
 * One labelled fact in the statistics panel, with figures set in tabular numerals so they do not
 * shift about as they change.
 *
 * @param name - What the fact is.
 * @param children - The fact itself.
 */
const Row = ({ name, children }: RowProps) => (
  <div className="flex gap-3 rounded-md px-1 py-1 transition-colors hover:bg-on-scrim/5">
    <dt className="w-40 shrink-0 text-on-scrim/50">{name}</dt>
    <dd className="min-w-0 break-words font-medium tabular-nums text-on-scrim">{children}</dd>
  </div>
);

Row.displayName = 'Row';

type GroupProps = {
  name: string;
  children: React.ReactNode;
};

/**
 * A titled run of related facts.
 *
 * The panel reads top to bottom as the stream's own journey — what it is, what arrived, what was
 * decided, what came out, how it is faring — and the headings are what make that order legible
 * rather than a list of everything Valence happens to know.
 *
 * @param name - What this group of facts is about.
 * @param children - The facts.
 */
const Group = ({ name, children }: GroupProps) => (
  <div className="mb-3 last:mb-0">
    <h4 className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-on-scrim/35">
      {name}
    </h4>
    <dl className="flex flex-col">{children}</dl>
  </div>
);

Group.displayName = 'Group';

/**
 * Describes a picture's size, or says nothing is known yet.
 *
 * @param width - How wide.
 * @param height - How tall.
 * @returns The size, or a note that there is not one to report.
 */
const size = (width: number | null, height: number | null): string =>
  width === null || height === null || width === 0
    ? 'not reported'
    : `${width.toString()}x${height.toString()}`;

/**
 * Everything Valence knows about what is on screen and how it got there: what the file is, what the
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
 * @param delivered - What the engine is actually being sent, where it has chosen a variant.
 * @param sessionStartSeconds - Where the session itself began, which is not always where the viewer
 *   is now.
 * @param party - How the watch party is faring, where this viewing is part of one.
 * @param onClose - Called to close the panel.
 */
const StreamStats = ({
  media,
  session,
  detail,
  health,
  delivered,
  sessionStartSeconds,
  party,
  onClose,
}: StreamStatsProps) => {
  const video = detail?.videoCodec ?? media.id;
  const audio = detail?.audioStreams[0] ?? null;
  const plan = session?.plan ?? null;

  return (
    <section
      aria-label="Stats for nerds"
      className="valence-rail valence-glass pointer-events-auto max-h-[calc(100svh-11rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-lg p-4 text-xs text-on-scrim"
    >
      <header className="mb-3 flex items-center justify-between gap-4 border-b border-on-scrim/10 pb-2">
        <h3 className="text-sm font-medium tracking-tight">Stats for nerds</h3>

        <Button isIconOnly variant="ghost" label="Close stats" size="sm" onClick={onClose}>
          <Icon of={XIcon} size={16} />
        </Button>
      </header>

      <div className="flex flex-col">
        <Group name="Session">
          <Row name="Title">{media.title}</Row>
          <Row name="Media id">{media.id}</Row>
          <Row name="Session">{session?.sessionId ?? 'not started'}</Row>
          <Row name="Mode">{session?.mode ?? 'deciding'}</Row>
          <Row name="Starts at">{formatDuration(sessionStartSeconds)}</Row>
          <Row name="Delivery">
            {session === null
              ? 'none'
              : session.delivery.kind === 'hls'
                ? `HLS — ${session.delivery.manifestUrl}`
                : `Direct — ${session.delivery.url}`}
          </Row>
        </Group>

        <Group name="Source">
          <Row name="Video">
            {detail === null
              ? 'unknown'
              : `${video} ${detail.width}x${detail.height} ${detail.videoRange}`}
          </Row>
          <Row name="Audio">
            {audio === null ? 'none' : `${audio.codec} ${audio.channels}ch ${audio.language ?? ''}`}
          </Row>
          <Row name="Subtitles">
            {detail === null || detail.subtitleStreams.length === 0
              ? 'none'
              : `${detail.subtitleStreams.length.toString()} tracks, first ${detail.subtitleStreams[0]?.format ?? ''}`}
          </Row>
        </Group>

        <Group name="Output">
          <Row name="Video">
            {delivered === null
              ? 'nothing selected yet'
              : `${delivered.videoCodec ?? 'unknown'} ${size(delivered.width, delivered.height)}${
                  delivered.frameRate === null ? '' : ` @ ${delivered.frameRate.toFixed(3)}fps`
                }`}
          </Row>
          <Row name="Audio">
            {delivered === null
              ? 'nothing selected yet'
              : `${delivered.audioCodec ?? 'unknown'}${
                  delivered.audioChannels === null ? '' : ` ${delivered.audioChannels.toString()}ch`
                }${
                  delivered.audioSampleRate === null
                    ? ''
                    : ` ${delivered.audioSampleRate.toString()}Hz`
                }`}
          </Row>
          <Row name="Container">{delivered?.mimeType ?? 'nothing selected yet'}</Row>
          <Row name="Bitrate">
            {delivered?.bitrateKbps === null || delivered === null
              ? 'not reported'
              : `${delivered.bitrateKbps.toString()}kbps`}
          </Row>
          <Row name="Presented size">{size(health.presentedWidth, health.presentedHeight)}</Row>
        </Group>

        <Group name="Plan">
          <Row name="Container">
            {plan === null ? 'deciding' : axis(plan.container.kind, plan.container.reason.detail)}
          </Row>
          <Row name="Video">{plan === null ? 'deciding' : videoAxis(plan.video)}</Row>
          <Row name="Audio">{plan === null ? 'deciding' : audioAxis(plan.audio)}</Row>
          <Row name="Subtitles">
            {plan === null ? 'deciding' : axis(plan.subtitles.kind, plan.subtitles.reason.detail)}
          </Row>
        </Group>

        <Group name="Playback">
          <Row name="Position">{formatDuration(health.positionSeconds)}</Row>
          <Row name="Frame on screen">{formatDuration(health.frameSeconds)}</Row>
          <Row name="Stream starts at">{formatDuration(health.streamFromSeconds)}</Row>
          <Row name="Buffered ahead">{seconds(health.bufferedAheadSeconds)}</Row>
          <Row name="Encoded so far">{seconds(health.encodedSeconds)}</Row>
          <Row name="Frames dropped">
            {health.droppedFrames === null || health.decodedFrames === null
              ? 'not reported'
              : `${health.droppedFrames.toString()} of ${health.decodedFrames.toString()}`}
          </Row>
        </Group>

        {party === undefined ? null : (
          <Group name="Watch party">
            <Row name="Watching together">{party.members.toString()}</Row>
            <Row name="Room state">
              {party.isHeld ? 'held' : party.isPlaying ? 'playing' : 'paused'}
            </Row>
            <Row name="Waiting for">
              {party.waitingFor.length === 0 ? 'nobody' : party.waitingFor.join(', ')}
            </Row>
            <Row name="Room position">
              {party.referenceSeconds === null
                ? 'this tab keeps time'
                : formatDuration(party.referenceSeconds)}
            </Row>
            <Row name="Out by">
              {party.referenceSeconds === null
                ? 'n/a'
                : seconds(party.referenceSeconds - health.positionSeconds)}
            </Row>
            <Row name="Clock jitter">{`${Math.round(party.jitterMs).toString()}ms`}</Row>
          </Group>
        )}

        {session === null || session.warnings.length === 0 ? null : (
          <Group name="Warnings">
            <Row name="From the server">{session.warnings.join(' · ')}</Row>
          </Group>
        )}
      </div>
    </section>
  );
};

StreamStats.displayName = 'StreamStats';

export { StreamStats };
