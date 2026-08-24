import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { WEBHOOK_PAYLOAD_VERSION } from '@ValenceContracts/schemas/Webhook';
import { formatWebhookBody } from './formatWebhookBody';
import type { WebhookPayload } from '@ValenceContracts/schemas/Webhook';

const DiscordMessageSchema = z.object({
  embeds: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      color: z.number(),
      author: z.object({ name: z.string() }),
      fields: z.array(z.object({ name: z.string(), value: z.string() })),
    }),
  ),
});

const anEnvelope = {
  version: WEBHOOK_PAYLOAD_VERSION,
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  occurredAt: '2026-08-14T20:00:00.000Z',
} as const;

const aFailure: WebhookPayload = {
  ...anEnvelope,
  event: 'job.failed',
  data: {
    kind: 'library.scan',
    label: 'Scan for changes',
    jobId: 'job-1',
    subject: 'library-1',
    subjectName: 'Films',
    reason: 'ffmpeg exited with 1',
  },
};

const aServerWideCompletion: WebhookPayload = {
  ...anEnvelope,
  event: 'job.completed',
  data: {
    kind: 'server.cleanupSessions',
    label: 'Clean up sessions',
    jobId: 'job-2',
    subject: null,
    subjectName: null,
  },
};

describe('formatWebhookBody', () => {
  it('sends the whole envelope to a generic receiver', () => {
    const written = formatWebhookBody('generic', aFailure);

    expect(written.contentType).toBe('application/json');
    expect(JSON.parse(written.body)).toStrictEqual(aFailure);
  });

  it('gives Discord an embed, not a line of text and not an envelope', () => {
    const written = formatWebhookBody('discord', aFailure);
    const sent = DiscordMessageSchema.parse(JSON.parse(written.body));

    expect(written.contentType).toBe('application/json');
    expect(sent.embeds).toHaveLength(1);
    expect(sent.embeds[0]?.title).toContain('Scan for changes');
    expect(sent.embeds[0]?.description).toContain('ffmpeg exited with 1');
  });

  it('sends no more embeds in one message than Discord will render', () => {
    const written = formatWebhookBody('discord', aFailure);
    const sent = DiscordMessageSchema.parse(JSON.parse(written.body));

    expect(sent.embeds.length).toBeLessThanOrEqual(10);
  });

  it('leaves the other presets alone, which is the whole of what changed', () => {
    expect(formatWebhookBody('generic', aFailure).body).toBe(JSON.stringify(aFailure));
    expect(formatWebhookBody('ntfy', aFailure).contentType).toBe('text/plain');
  });

  it('gives ntfy plain text, because JSON would be printed verbatim', () => {
    const written = formatWebhookBody('ntfy', aFailure);

    expect(written.contentType).toBe('text/plain');
    expect(written.body).toContain('ffmpeg exited with 1');
    expect(written.body.startsWith('{')).toBe(false);
  });

  it('names which library a job was about, by its name and never by its identifier', () => {
    const written = formatWebhookBody('ntfy', aFailure).body;

    expect(written).toContain('Films');
    expect(written).not.toContain('library-1');
    expect(written).not.toContain('library.scan');
  });

  it('says nothing about a subject for a job that had none', () => {
    const written = formatWebhookBody('ntfy', aServerWideCompletion);

    expect(written.body).toContain('Clean up sessions');
    expect(written.body).not.toContain('null');
    expect(written.body).not.toContain('()');
  });

  it('names the subject of a job that finished, as well as one that failed', () => {
    const written = formatWebhookBody('ntfy', {
      ...anEnvelope,
      event: 'job.completed',
      data: {
        kind: 'library.scan',
        label: 'Scan for changes',
        jobId: 'job-3',
        subject: 'library-1',
        subjectName: 'Films',
      },
    });

    expect(written.body).toContain('for Films');
  });

  it('says nothing about a subject for a failure that had none', () => {
    const written = formatWebhookBody('ntfy', {
      ...anEnvelope,
      event: 'job.failed',
      data: {
        kind: 'server.cleanupSessions',
        label: 'Clean up sessions',
        jobId: 'job-4',
        subject: null,
        subjectName: null,
        reason: 'no space',
      },
    });

    expect(written.body).toContain('no space');
    expect(written.body).not.toContain('()');
  });

  it('counts files it could not read, and says nothing of them when there were none', () => {
    const scanned = (failed: number) =>
      formatWebhookBody('ntfy', {
        ...anEnvelope,
        event: 'library.scanned',
        data: {
          libraries: [
            {
              libraryId: 'library-1',
              libraryName: 'Films',
              added: 2,
              updated: 1,
              removed: 0,
              failed,
              arrived: [],
              arrivedNotListed: 0,
            },
          ],
          added: 2,
          updated: 1,
          removed: 0,
          failed,
        },
      }).body;

    expect(scanned(3)).toContain('3 unreadable');
    expect(scanned(0)).not.toContain('unreadable');
  });

  it('writes a test as reassurance rather than as an alarm', () => {
    const written = formatWebhookBody('ntfy', { ...anEnvelope, event: 'webhook.test', data: {} });

    expect(written.body).toContain('Nothing has gone wrong');
  });

  it('says what a viewer would notice when the catalogue is unreachable', () => {
    const written = formatWebhookBody('ntfy', {
      ...anEnvelope,
      event: 'catalogue.unreachable',
      data: {},
    });

    expect(written.body).toContain('without matching them');
  });

  it('names the library and what a scan changed', () => {
    const written = formatWebhookBody('ntfy', {
      ...anEnvelope,
      event: 'library.scanned',
      data: {
        libraries: [
          {
            libraryId: '3f2504e0-4f89-41d3-9a0c-0305e82c3302',
            libraryName: 'Films',
            added: 4,
            updated: 1,
            removed: 0,
            failed: 0,
            arrived: [],
            arrivedNotListed: 0,
          },
        ],
        added: 4,
        updated: 1,
        removed: 0,
        failed: 0,
      },
    });

    expect(written.body).toContain('Films');
    expect(written.body).toContain('4 added');
    expect(written.body).toContain('0 removed');
  });

  it('states removals, which is the number a mount going missing shows up in', () => {
    const written = formatWebhookBody('ntfy', {
      ...anEnvelope,
      event: 'library.scanned',
      data: {
        libraries: [
          {
            libraryId: '3f2504e0-4f89-41d3-9a0c-0305e82c3302',
            libraryName: 'Films',
            added: 0,
            updated: 0,
            removed: 214,
            failed: 0,
            arrived: [],
            arrivedNotListed: 0,
          },
        ],
        added: 0,
        updated: 0,
        removed: 214,
        failed: 0,
      },
    });

    expect(written.body).toContain('214 removed');
  });

  it('mentions unreadable files only when there are some', () => {
    const clean = formatWebhookBody('ntfy', {
      ...anEnvelope,
      event: 'library.scanned',
      data: {
        libraries: [
          {
            libraryId: '3f2504e0-4f89-41d3-9a0c-0305e82c3302',
            libraryName: 'Films',
            added: 1,
            updated: 0,
            removed: 0,
            failed: 0,
            arrived: [],
            arrivedNotListed: 0,
          },
        ],
        added: 1,
        updated: 0,
        removed: 0,
        failed: 0,
      },
    });

    expect(clean.body).not.toContain('unreadable');
  });

  it('says a recovery is not something to act on', () => {
    const written = formatWebhookBody('ntfy', {
      ...anEnvelope,
      event: 'transcoder.reachable',
      data: {},
    });

    expect(written.body).toContain('answering again');
    expect(written.body).toContain('Nothing needs doing');
  });

  it('says the same for a catalogue that came back', () => {
    const written = formatWebhookBody('ntfy', {
      ...anEnvelope,
      event: 'catalogue.reachable',
      data: {},
    });

    expect(written.body).toContain('Nothing needs doing');
  });

  it('says a job that has never once worked has never once worked', () => {
    const written = formatWebhookBody('ntfy', {
      ...anEnvelope,
      event: 'job.stalled',
      data: {
        kind: 'library.scan.scheduled',
        label: 'Scan for changes',
        failures: 457,
        everSucceeded: false,
        reason: 'Cannot read properties of null',
      },
    });

    expect(written.body).toContain('Scan for changes');
    expect(written.body).toContain('never once succeeded');
    expect(written.body).toContain('457');
    expect(written.body).toContain('Cannot read properties of null');
  });

  it('says a job that used to work has stopped working', () => {
    const written = formatWebhookBody('ntfy', {
      ...anEnvelope,
      event: 'job.stalled',
      data: {
        kind: 'server.checkDiskSpace',
        label: 'Check disk space',
        failures: 3,
        everSucceeded: true,
        reason: 'the disk is gone',
      },
    });

    expect(written.body).toContain('since it last worked');
  });

  it('says a job that is working again needs nothing doing', () => {
    const written = formatWebhookBody('ntfy', {
      ...anEnvelope,
      event: 'job.working',
      data: { kind: 'server.checkDiskSpace', label: 'Check disk space' },
    });

    expect(written.body).toContain('Check disk space');
    expect(written.body).toContain('Nothing needs doing');
  });

  it('says which disk is filling and how much is left', () => {
    const written = formatWebhookBody('ntfy', {
      ...anEnvelope,
      event: 'disk.low',
      data: { mountPoint: '/media', totalBytes: 2_000_000_000_000, availableBytes: 5_000_000_000 },
    });

    expect(written.body).toContain('/media');
    expect(written.body).toContain('4.7 GB');
    expect(written.body).toContain('1.8 TB');
  });

  it('says a disk with room again needs nothing doing', () => {
    const written = formatWebhookBody('ntfy', {
      ...anEnvelope,
      event: 'disk.recovered',
      data: {
        mountPoint: '/media',
        totalBytes: 2_000_000_000_000,
        availableBytes: 900_000_000_000,
      },
    });

    expect(written.body).toContain('/media');
    expect(written.body).toContain('Nothing needs doing');
  });

  it('carries the reason the transcoder could not be reached', () => {
    const written = formatWebhookBody('ntfy', {
      ...anEnvelope,
      event: 'transcoder.unreachable',
      data: { reason: 'connection refused' },
    });

    expect(written.body).toContain('connection refused');
  });
});
