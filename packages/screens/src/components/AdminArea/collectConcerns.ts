import type { ActiveSession, AdminOverview, Monitor } from '@ValenceClient/admin/fetchAdmin';
import type { Library } from '@ValenceContracts/schemas/Library';
import { fluxCpuShare } from './fluxCpuShare';
import { libraryDisk } from './libraryDisk';
import { memoryEnvelope } from './memoryEnvelope';
import { formatBytes } from '@ValenceCore/functions/formatBytes';

type ConcernTone = 'broken' | 'attention' | 'setup';

type Concern = {
  id: string;
  tone: ConcernTone;
  title: string;
  detail: string;
  panel: string;
};

type CollectConcernsOptions = {
  overview: AdminOverview | null;
  monitor: Monitor | null;
  libraries: Library[];
  sessions?: ActiveSession[];
  history?: number[];
  encoderHistory?: number[];
};

const MEMORY_PRESSURE = 0.92;

const CPU_PRESSURE = 90;

const CPU_READINGS = 15;

const ENCODER_PRESSURE = 90;

const DISK_PRESSURE = 0.95;

const FLUX_BLAME = 50;

const STARVED_SECONDS = 2;

const TONE_ORDER: Record<ConcernTone, number> = { broken: 0, attention: 1, setup: 2 };

/**
 * Gathers everything wrong with this server into one ordered list, worst first: a service that cannot
 * be reached, jobs that failed, resources under pressure, streams about to stall, and libraries
 * nobody has scanned yet. Each carries the panel it can be dealt with in, so the banner can send an
 * administrator straight there rather than describing where to look.
 *
 * @param overview - What the server reports about itself, or null before it has answered.
 * @param monitor - The live readings, or null before any have arrived.
 * @param libraries - The libraries configured.
 * @param sessions - What is being watched at the moment.
 * @param history - Recent processor readings, used to tell a spike from sustained load.
 * @param encoderHistory - The same for the graphics encoder.
 * @returns The concerns, broken things before things merely wanting attention.
 */
const collectConcerns = ({
  overview,
  monitor,
  libraries,
  sessions = [],
  history = [],
  encoderHistory = [],
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
      title: 'The media service is running an FFmpeg older than Valence supports',
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

  const stalled = overview?.jobs.stalled ?? [];
  const worst = stalled[0];

  if (worst !== undefined) {
    concerns.push({
      id: 'stalled-jobs',
      tone: 'broken',
      title:
        stalled.length === 1
          ? worst.everSucceeded
            ? `${worst.label} fails every time it runs`
            : `${worst.label} has never once succeeded`
          : `${stalled.length.toString()} kinds of job fail every time they run`,
      detail: `Nothing on its schedule has happened since. Last failure: ${worst.reason}`,
      panel: 'jobs',
    });
  }

  const resources = monitor?.resources ?? null;

  const memory = memoryEnvelope(resources);

  if (memory !== null && memory.usedBytes / memory.totalBytes > MEMORY_PRESSURE) {
    concerns.push({
      id: 'memory',
      tone: 'attention',
      title: memory.isLimited
        ? 'Valence is nearly at the memory it is allowed'
        : 'Memory is nearly full',
      detail: 'Converting several things at once may fail or be killed.',
      panel: 'activity',
    });
  }

  const disk = libraryDisk(
    resources?.disks ?? [],
    libraries.map((library) => library.path),
  );

  if (
    disk !== null &&
    disk.totalBytes > 0 &&
    (disk.totalBytes - disk.availableBytes) / disk.totalBytes > DISK_PRESSURE
  ) {
    concerns.push({
      id: 'disk',
      tone: 'attention',
      title: 'The library disk is nearly full',
      detail: `${formatBytes(disk.availableBytes)} left on ${disk.mountPoint}. A scan that finds new files may have nowhere to put what it makes of them.`,
      panel: 'libraries',
    });
  }

  const recent = history.slice(-CPU_READINGS);

  if (recent.length === CPU_READINGS && recent.every((reading) => reading > CPU_PRESSURE)) {
    const share = fluxCpuShare(resources);

    concerns.push({
      id: 'cpu',
      tone: 'attention',
      title: 'The processor has been at full stretch',
      detail:
        share === null
          ? 'Playback that needs converting may stutter while it lasts.'
          : share >= FLUX_BLAME
            ? `Valence is using ${share.toFixed(0)}% of the machine, so this is its own work. Playback that needs converting may stutter while it lasts.`
            : `Valence is using ${share.toFixed(0)}% of the machine, so most of this is something else on the box.`,
      panel: 'activity',
    });
  }

  const encoderRecent = encoderHistory.slice(-CPU_READINGS);

  if (
    encoderRecent.length === CPU_READINGS &&
    encoderRecent.every((reading) => reading > ENCODER_PRESSURE)
  ) {
    concerns.push({
      id: 'encoder',
      tone: 'attention',
      title: 'The graphics encoder has been at full stretch',
      detail:
        'The next stream that needs converting will fall back to the processor, which is several times the work.',
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

export { collectConcerns };
export type { Concern, ConcernTone };
