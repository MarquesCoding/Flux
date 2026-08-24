import { formatBytes } from '@ValenceCore/functions/formatBytes';
import { discordEmbedFor } from './discordEmbedFor';
import type { PlaybackMode } from '@ValenceContracts/functions/describePlaybackMode';
import type { WebhookPayload, WebhookPreset } from '@ValenceContracts/schemas/Webhook';

const HOW_PLAYED: Record<PlaybackMode, string> = {
  DirectPlay: 'sent as it lies',
  Remux: 'repackaged but not re-encoded',
  DirectStream: 'with only the sound converted',
  Transcode: 'transcoded',
};

type WebhookRequestBody = {
  body: string;
  contentType: string;
};

type NamedItem = {
  title: string;
  seriesTitle: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  year: number | null;
};

type NamedViewer = {
  accountName: string | null;
  profileName: string | null;
};

/**
 * Names one thing in a library the way a person would say it — an episode by its place in its
 * series, anything else by its title and year.
 *
 * @param item - What arrived, left, or is being watched.
 * @returns The name to say.
 */
const nameOf = (item: NamedItem): string => {
  if (item.seriesTitle !== null && item.seasonNumber !== null && item.episodeNumber !== null) {
    const season = item.seasonNumber.toString().padStart(2, '0');
    const episode = item.episodeNumber.toString().padStart(2, '0');

    return `${item.seriesTitle} S${season}E${episode} — ${item.title}`;
  }

  return item.year === null ? item.title : `${item.title} (${item.year.toString()})`;
};

/**
 * Names whoever is watching, preferring the profile because that is who picked it, and falling back
 * to the account or to nobody at all — a share link is watched by no account and no profile.
 *
 * @param viewer - Who is watching.
 * @returns What to call them.
 */
const nameOfViewer = (viewer: NamedViewer): string =>
  viewer.profileName ?? viewer.accountName ?? 'Somebody with a share link';

/**
 * Writes what happened as one sentence, for the chat services that show a line rather than render a
 * payload — a delivery nobody can read on a phone is a delivery that may as well not have been sent.
 *
 * @param payload - What happened.
 * @returns The sentence to send.
 */
const sentenceFor = (payload: WebhookPayload): string => {
  switch (payload.event) {
    case 'webhook.test': {
      return 'Valence can reach this subscription. Nothing has gone wrong; somebody pressed test.';
    }

    case 'job.completed': {
      const about = payload.data.subjectName === null ? '' : ` for ${payload.data.subjectName}`;

      return `${payload.data.label}${about} finished.`;
    }

    case 'job.failed': {
      const about = payload.data.subjectName === null ? '' : ` for ${payload.data.subjectName}`;

      return `${payload.data.label}${about} failed — ${payload.data.reason}`;
    }

    case 'library.scanned': {
      const said = payload.data.libraries.map((one) => {
        const counts = [
          `${one.added.toString()} added`,
          `${one.updated.toString()} updated`,
          `${one.removed.toString()} removed`,
          ...(one.failed === 0 ? [] : [`${one.failed.toString()} unreadable`]),
        ];
        const andMore =
          one.arrivedNotListed === 0 ? '' : ` and ${one.arrivedNotListed.toString()} more`;
        const titles = one.arrived.length === 0 ? '' : `\n${one.arrived.join(', ')}${andMore}`;

        return `${one.libraryName}: ${counts.join(', ')}${titles}`;
      });

      return said.join('\n');
    }

    case 'catalogue.unreachable': {
      return 'The catalogue could not be reached. Scans will import files without matching them.';
    }

    case 'catalogue.reachable': {
      return 'The catalogue can be reached again. Nothing needs doing.';
    }

    case 'transcoder.unreachable': {
      return `The transcoder could not be reached — ${payload.data.reason}`;
    }

    case 'transcoder.reachable': {
      return 'The transcoder is answering again. Nothing needs doing.';
    }

    case 'job.stalled': {
      return payload.data.everSucceeded
        ? `${payload.data.label} has failed every time it has run since it last worked — ${payload.data.failures.toString()} attempts, most recently: ${payload.data.reason}`
        : `${payload.data.label} has never once succeeded — ${payload.data.failures.toString()} attempts, most recently: ${payload.data.reason}`;
    }

    case 'job.working': {
      return `${payload.data.label} has run without failing. Nothing needs doing.`;
    }

    case 'disk.low': {
      return `${payload.data.mountPoint} is running out of room — ${formatBytes(payload.data.availableBytes)} left of ${formatBytes(payload.data.totalBytes)}.`;
    }

    case 'disk.recovered': {
      return `${payload.data.mountPoint} has room again — ${formatBytes(payload.data.availableBytes)} free. Nothing needs doing.`;
    }

    case 'auth.succeeded': {
      const from = payload.data.address === null ? '' : ` from ${payload.data.address}`;

      return `${payload.data.name} signed in on ${payload.data.deviceLabel}${from}.`;
    }

    case 'auth.failed': {
      const from = payload.data.address === null ? '' : ` from ${payload.data.address}`;

      return `A sign-in as ${payload.data.identifier} was refused on ${payload.data.deviceLabel}${from} — ${payload.data.reason}`;
    }

    case 'account.created': {
      return `${payload.data.name} now has an account.`;
    }

    case 'account.deleted': {
      return `${payload.data.name}'s account was deleted.`;
    }

    case 'account.roleChanged': {
      return payload.data.change === 'given'
        ? `${payload.data.name} was given ${payload.data.role}.`
        : `${payload.data.name} no longer has ${payload.data.role}.`;
    }

    case 'media.added': {
      return `${nameOf(payload.data)} arrived in ${payload.data.libraryName}.`;
    }

    case 'media.removed': {
      return `${nameOf(payload.data)} is no longer in ${payload.data.libraryName}.`;
    }

    case 'playback.started': {
      return `${nameOfViewer(payload.data)} started watching ${nameOf(payload.data.item)} on ${payload.data.deviceLabel}, ${HOW_PLAYED[payload.data.mode]}.`;
    }

    case 'playback.stopped': {
      const { positionSeconds, durationSeconds } = payload.data;
      const through =
        positionSeconds === null || durationSeconds === null || durationSeconds === 0
          ? ''
          : ` ${Math.round((positionSeconds / durationSeconds) * 100).toString()}% of the way through`;

      return `${nameOfViewer(payload.data)} stopped watching ${nameOf(payload.data.item)}${through}.`;
    }
  }
};

/**
 * Writes a delivery in the shape its subscriber expects — the event itself for anything generic, and
 * the message shapes Discord and Slack require for those. The same event, said in whichever way the
 * receiver understands.
 *
 * @param preset The shape this subscriber expects.
 * @param payload The event being delivered.
 */
const formatWebhookBody = (preset: WebhookPreset, payload: WebhookPayload): WebhookRequestBody => {
  switch (preset) {
    case 'generic': {
      return { body: JSON.stringify(payload), contentType: 'application/json' };
    }

    case 'discord': {
      return {
        body: JSON.stringify({ embeds: [discordEmbedFor(payload, sentenceFor(payload))] }),
        contentType: 'application/json',
      };
    }

    case 'ntfy': {
      return { body: sentenceFor(payload), contentType: 'text/plain' };
    }
  }
};

export { formatWebhookBody };
