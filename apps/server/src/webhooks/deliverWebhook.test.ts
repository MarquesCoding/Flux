import { describe, expect, it, vi } from 'vitest';
import { WEBHOOK_PAYLOAD_VERSION } from '@FluxContracts/schemas/Webhook';
import { deliverWebhook } from './deliverWebhook';
import { signWebhookPayload, WEBHOOK_SIGNATURE_HEADER } from './signWebhookPayload';
import type { WebhookPayload } from '@FluxContracts/schemas/Webhook';
import type { WebhookFetcher, WebhookTarget } from './deliverWebhook';
import type { Mock } from 'vitest';

const aPayload: WebhookPayload = {
  version: WEBHOOK_PAYLOAD_VERSION,
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  occurredAt: '2026-08-14T20:00:00.000Z',
  event: 'job.failed',
  data: { kind: 'library.scan', jobId: 'job-1', subject: 'library-1', reason: 'no space left' },
};

const aTarget: WebhookTarget = {
  url: 'https://example.com/hook',
  preset: 'generic',
  secret: 'whsec_1',
};

const answering = (status: number): Mock<WebhookFetcher> =>
  vi.fn<WebhookFetcher>().mockResolvedValue({ ok: status >= 200 && status < 300, status });

const requestMadeBy = (fetchImpl: Mock<WebhookFetcher>) => {
  const call = fetchImpl.mock.calls[0];

  if (call === undefined) {
    throw new Error('No delivery was attempted.');
  }

  return call[1];
};

describe('deliverWebhook', () => {
  it('posts the event and reports that it landed', async () => {
    const fetchImpl = answering(204);

    const attempt = await deliverWebhook(aTarget, aPayload, fetchImpl);

    expect(attempt).toStrictEqual({ ok: true, status: 204, error: null });
    expect(fetchImpl).toHaveBeenCalledWith('https://example.com/hook', expect.anything());
  });

  it('signs the exact bytes it sends', async () => {
    const fetchImpl = answering(200);

    await deliverWebhook(aTarget, aPayload, fetchImpl);

    const request = requestMadeBy(fetchImpl);

    expect(request.headers[WEBHOOK_SIGNATURE_HEADER]).toBe(
      signWebhookPayload('whsec_1', request.body),
    );
  });

  it('keeps the status a receiver refused with, so a reader can tell why', async () => {
    const attempt = await deliverWebhook(aTarget, aPayload, answering(500));

    expect(attempt.ok).toBe(false);
    expect(attempt.status).toBe(500);
    expect(attempt.error).toContain('500');
  });

  it('separates nothing answering from something answering badly', async () => {
    const refused = vi.fn<WebhookFetcher>().mockRejectedValue(new Error('connect ECONNREFUSED'));

    const attempt = await deliverWebhook(aTarget, aPayload, refused);

    expect(attempt.status).toBeNull();
    expect(attempt.error).toContain('ECONNREFUSED');
  });

  it('does not throw when the receiver does', async () => {
    const exploding = vi.fn<WebhookFetcher>().mockRejectedValue(new Error('boom'));

    await expect(deliverWebhook(aTarget, aPayload, exploding)).resolves.toMatchObject({
      ok: false,
    });
  });

  it('refuses the metadata address even though the row said to send there', async () => {
    const fetchImpl = answering(200);

    const attempt = await deliverWebhook(
      { ...aTarget, url: 'http://169.254.169.254/latest/meta-data/' },
      aPayload,
      fetchImpl,
    );

    expect(attempt.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('gives up rather than holding a worker for ever', async () => {
    const hanging = vi.fn<WebhookFetcher>(
      async (_url, init) =>
        new Promise<{ ok: boolean; status: number }>((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            reject(new Error('The operation was aborted due to timeout'));
          });
        }),
    );

    const attempt = await deliverWebhook(aTarget, aPayload, hanging, 10);

    expect(attempt.ok).toBe(false);
    expect(attempt.error).toContain('timeout');
  });

  it('sends what the preset asked for rather than the envelope every time', async () => {
    const fetchImpl = answering(200);

    await deliverWebhook({ ...aTarget, preset: 'ntfy' }, aPayload, fetchImpl);

    const request = requestMadeBy(fetchImpl);

    expect(request.headers['content-type']).toBe('text/plain');
    expect(request.body).toContain('no space left');
  });
});
