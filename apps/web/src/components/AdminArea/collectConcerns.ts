import type { ActiveSession, AdminOverview, Monitor } from '@FluxWeb/admin/fetchAdmin';
import type { Library } from '@FluxContracts/schemas/Library';

/**
 * How much somebody should care, which is what decides the order.
 *
 * `broken` — something is not working and playback may be affected.
 * `attention` — nothing is broken, but something needs a person.
 * `setup` — the instance works and is not finished being set up.
 */
type ConcernTone = 'broken' | 'attention' | 'setup';

type Concern = {
  id: string;
  tone: ConcernTone;
  title: string;
  detail: string;
  /**
   * Which panel explains it, so the overview can be a way in rather than a
   * place that tells you something is wrong and leaves you to find it.
   */
  panel: string;
};

type CollectConcernsOptions = {
  overview: AdminOverview | null;
  monitor: Monitor | null;
  libraries: Library[];
  /**
   * Who is watching, so a viewer whose stream keeps running dry is reported
   * rather than merely visible on another panel.
   */
  sessions?: ActiveSession[];
  /**
   * Processor readings, oldest first. Sustained load is worth mentioning and
   * one high reading is not — a transcode pinning the box for a moment is the
   * server working, not failing.
   */
  history?: number[];
};

/**
 * The share of memory in use past which it is worth mentioning.
 *
 * High enough that an ordinary server running warm says nothing — a media
 * server using most of its memory for page cache is working correctly, and a
 * warning that is usually on is one nobody reads.
 */
const MEMORY_PRESSURE = 0.92;

/**
 * The processor share, sustained, past which it is worth mentioning.
 *
 * Measured across a run of readings rather than the latest one, because a
 * transcode starting takes the box to a hundred percent for a few seconds and
 * that is the server doing its job.
 */
const CPU_PRESSURE = 90;

/**
 * How many readings have to agree before load counts as sustained.
 *
 * A reading a second, so this is the last quarter minute.
 */
const CPU_READINGS = 15;

/**
 * How little buffer a playing stream can hold before it is in trouble.
 *
 * Below this and the next stall is seconds away rather than hypothetical.
 */
const STARVED_SECONDS = 2;

const TONE_ORDER: Record<ConcernTone, number> = { broken: 0, attention: 1, setup: 2 };

/**
 * What is wrong with this server right now, worst first.
 *
 * Everything here is already on screen somewhere — a failed job in the job
 * list, a library that has never scanned in the library list, the transcoder
 * badge in the header. The point is that answering "is everything all right"
 * currently means visiting four panels and assembling it yourself.
 *
 * Deliberately quiet. Anything reported here has to be worth interrupting
 * somebody for, or the overview becomes a page of warnings that are always
 * present and therefore never read. A server with nothing to say answers with
 * nothing.
 *
 * Nulls are treated as "not known yet" rather than as problems: a page that
 * has not finished loading is not a page full of faults.
 */
const collectConcerns = ({
  overview,
  monitor,
  libraries,
  sessions = [],
  history = [],
}: CollectConcernsOptions): Concern[] => {
  const concerns: Concern[] = [];

  if (overview !== null && !overview.transcoder.isReachable) {
    const address = overview.transcoder.address;

    concerns.push({
      id: 'transcoder',
      tone: 'broken',
      title: 'The media service is unreachable',
      detail:
        address === ''
          ? 'Nothing that needs converting will play until it is back.'
          : `Nothing that needs converting will play until it is back. Looked for it at ${address}.`,
      panel: 'activity',
    });
  }

  if (
    overview !== null &&
    overview.transcoder.isReachable &&
    !overview.transcoder.ffmpegSupported
  ) {
    const version = overview.transcoder.ffmpegVersion;

    concerns.push({
      id: 'ffmpeg-version',
      tone: 'attention',
      title: 'The media service is running an FFmpeg older than Flux supports',
      detail:
        version === null
          ? 'Everything still plays, but the filters that keep frames on the graphics card may be missing, so transcodes cost several times more than they need to.'
          : `Everything still plays on ${version}, but the filters that keep frames on the graphics card may be missing, so transcodes cost several times more than they need to.`,
      panel: 'activity',
    });
  }

  const failed = (monitor?.queue.jobs ?? []).filter((job) => job.state === 'failed');

  if (failed.length > 0) {
    concerns.push({
      id: 'failed-jobs',
      tone: 'broken',
      title: failed.length === 1 ? 'A job failed' : `${failed.length.toString()} jobs failed`,
      detail: failed[0]?.detail ?? 'Look at the job list for what went wrong.',
      panel: 'jobs',
    });
  }

  const resources = monitor?.resources ?? null;

  if (
    resources !== null &&
    resources.systemMemoryTotalBytes > 0 &&
    resources.systemMemoryUsedBytes / resources.systemMemoryTotalBytes > MEMORY_PRESSURE
  ) {
    concerns.push({
      id: 'memory',
      tone: 'attention',
      title: 'Memory is nearly full',
      detail: 'Converting several things at once may fail or be killed.',
      panel: 'activity',
    });
  }

  const recent = history.slice(-CPU_READINGS);

  if (recent.length === CPU_READINGS && recent.every((reading) => reading > CPU_PRESSURE)) {
    concerns.push({
      id: 'cpu',
      tone: 'attention',
      title: 'The processor has been at full stretch',
      detail: 'Playback that needs converting may stutter while it lasts.',
      panel: 'activity',
    });
  }

  const starved = sessions.filter(
    (session) =>
      session.playback !== null &&
      session.playback.isPlaying &&
      session.playback.health !== null &&
      session.playback.health.bufferedAheadSeconds < STARVED_SECONDS,
  );

  if (starved.length > 0) {
    concerns.push({
      id: 'starved-sessions',
      tone: 'attention',
      title:
        starved.length === 1
          ? `${starved[0]?.profileName ?? 'Somebody'} is running out of buffer`
          : `${starved.length.toString()} streams are running out of buffer`,
      detail: 'They are seconds from stalling. The network or the box is behind.',
      panel: 'activity',
    });
  }

  const unscanned = libraries.filter((library) => library.lastScannedAt === null);

  if (unscanned.length > 0) {
    concerns.push({
      id: 'unscanned',
      tone: 'attention',
      title:
        unscanned.length === 1
          ? `${unscanned[0]?.name ?? 'A library'} has never been scanned`
          : `${unscanned.length.toString()} libraries have never been scanned`,
      detail: 'Nothing in them can be watched until they have been.',
      panel: 'libraries',
    });
  }

  if (overview !== null && libraries.length === 0) {
    concerns.push({
      id: 'no-libraries',
      tone: 'setup',
      title: 'There are no libraries yet',
      detail: 'Add one pointing at a folder of media.',
      panel: 'libraries',
    });
  }

  if (overview !== null && !overview.settings.hasCatalogueKey) {
    concerns.push({
      id: 'no-catalogue-key',
      tone: 'setup',
      title: 'No metadata catalogue key is set',
      detail: 'Titles, artwork and years come from filenames alone without one.',
      panel: 'settings',
    });
  }

  return [...concerns].sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
};

export { collectConcerns, MEMORY_PRESSURE, CPU_PRESSURE, CPU_READINGS, STARVED_SECONDS };
export type { Concern, ConcernTone };
