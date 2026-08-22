import { formatBytes } from '@FluxCore/functions/formatBytes';
import type { WebhookPayload, WebhookPreset } from '@FluxContracts/schemas/Webhook';

type WebhookRequestBody = {
  body: string;
  contentType: string;
};

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
      const about = payload.data.subject === null ? '' : ` (${payload.data.subject})`;

      return `Finished: ${payload.data.kind}${about}`;
    }

    case 'job.failed': {
      const about = payload.data.subject === null ? '' : ` (${payload.data.subject})`;

      return `Failed: ${payload.data.kind}${about} — ${payload.data.reason}`;
    }

    case 'library.scanned': {
      const { libraryName, added, updated, removed, failed } = payload.data;
      const counts = [
        `${added.toString()} added`,
        `${updated.toString()} updated`,
        `${removed.toString()} removed`,
        ...(failed === 0 ? [] : [`${failed.toString()} unreadable`]),
      ];

      return `${libraryName}: ${counts.join(', ')}`;
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
        body: JSON.stringify({ content: sentenceFor(payload) }),
        contentType: 'application/json',
      };
    }

    case 'ntfy': {
      return { body: sentenceFor(payload), contentType: 'text/plain' };
    }
  }
};

export { formatWebhookBody };
