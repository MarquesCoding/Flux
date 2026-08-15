import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { WEBHOOK_PAYLOAD_VERSION } from '@FluxContracts/schemas/Webhook';
import { formatWebhookBody } from './formatWebhookBody';
import type { WebhookPayload } from '@FluxContracts/schemas/Webhook';

const DiscordMessageSchema = z.object({ content: z.string() });

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
    jobId: 'job-1',
    subject: 'library-1',
    reason: 'ffmpeg exited with 1',
  },
};

const aServerWideCompletion: WebhookPayload = {
  ...anEnvelope,
  event: 'job.completed',
  data: { kind: 'server.cleanupSessions', jobId: 'job-2', subject: null },
};

describe('formatWebhookBody', () => {
  it('sends the whole envelope to a generic receiver', () => {
    const written = formatWebhookBody('generic', aFailure);

    expect(written.contentType).toBe('application/json');
    expect(JSON.parse(written.body)).toStrictEqual(aFailure);
  });

  it('gives Discord something a person reads, not an envelope', () => {
    const written = formatWebhookBody('discord', aFailure);
    const sent = DiscordMessageSchema.parse(JSON.parse(written.body));

    expect(written.contentType).toBe('application/json');
    expect(sent.content).toContain('library.scan');
    expect(sent.content).toContain('ffmpeg exited with 1');
  });

  it('gives ntfy plain text, because JSON would be printed verbatim', () => {
    const written = formatWebhookBody('ntfy', aFailure);

    expect(written.contentType).toBe('text/plain');
    expect(written.body).toContain('ffmpeg exited with 1');
    expect(written.body.startsWith('{')).toBe(false);
  });

  it('names which library a job was about', () => {
    expect(formatWebhookBody('ntfy', aFailure).body).toContain('library-1');
  });

  it('says nothing about a subject for a job that had none', () => {
    const written = formatWebhookBody('ntfy', aServerWideCompletion);

    expect(written.body).toContain('server.cleanupSessions');
    expect(written.body).not.toContain('null');
    expect(written.body).not.toContain('()');
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
        libraryId: '3f2504e0-4f89-41d3-9a0c-0305e82c3302',
        libraryName: 'Films',
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
        libraryId: '3f2504e0-4f89-41d3-9a0c-0305e82c3302',
        libraryName: 'Films',
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
        libraryId: '3f2504e0-4f89-41d3-9a0c-0305e82c3302',
        libraryName: 'Films',
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
