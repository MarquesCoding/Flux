import type { WebhookPayload, WebhookPreset } from '@FluxContracts/schemas/Webhook';

/**
 * A request as a preset wants it written.
 *
 * The content type travels with the body because the presets disagree about
 * it: ntfy takes the message as plain text, and telling it `application/json`
 * gets the JSON printed into somebody's notification verbatim.
 */
type WebhookRequestBody = {
  body: string;
  contentType: string;
};

/**
 * What happened, in a sentence somebody reads on a phone.
 *
 * Written per event rather than assembled from the identifier, because
 * `job.failed` turned into prose mechanically reads "job failed", which is
 * the one thing the reader already knows from having been sent it at all.
 * What they need is which job, and why.
 *
 * A recovery says so plainly and says nothing needs doing, because it arrives
 * through the same channel, at the same hour, looking like the alert that
 * woke somebody. Delivered with the same weight as an outage it reads as a
 * second alarm, and the point of sending it is the opposite.
 */
const sentenceFor = (payload: WebhookPayload): string => {
  switch (payload.event) {
    case 'webhook.test': {
      return 'Flux can reach this subscription. Nothing has gone wrong; somebody pressed test.';
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
  }
};

/**
 * Writes a delivery the way its subscriber reads.
 *
 * A preset is a body shape and nothing else. The same event, the same
 * retries, the same signature — only the encoding differs, so adding one
 * later means adding a case here rather than a second delivery path.
 *
 * `generic` sends Flux's own envelope, which is the one to build against:
 * it carries the version, the event name and typed data, and it is the only
 * form that keeps everything the server knew. The other two are lossy on
 * purpose, because neither Discord nor ntfy can be asked to understand an
 * envelope and both are read by a person rather than by a program.
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

export type { WebhookRequestBody };
