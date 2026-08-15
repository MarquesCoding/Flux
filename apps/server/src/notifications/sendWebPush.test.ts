import { describe, expect, it, vi } from 'vitest';
import { sendWebPush } from './sendWebPush';
import type { PushEndpoint } from './NotificationStore';
import type { WebPushSender } from './sendWebPush';

const aBrowser: PushEndpoint = {
  endpoint: 'https://push.example.com/abc',
  p256dh: 'a-key',
  auth: 'an-auth',
};

const aPayload = { title: 'Something new to watch', body: '12 episodes', link: null };

const keys = { publicKey: 'public', privateKey: 'private' };

const refusing = (statusCode: number) =>
  vi.fn<WebPushSender>().mockRejectedValue(Object.assign(new Error('refused'), { statusCode }));

describe('sendWebPush', () => {
  it('wakes the browser and says it landed', async () => {
    const send = vi.fn<WebPushSender>().mockResolvedValue({ statusCode: 201 });

    expect(await sendWebPush(aBrowser, aPayload, keys, send)).toBe('delivered');
  });

  it('sends the payload the service worker will draw', async () => {
    const send = vi.fn<WebPushSender>().mockResolvedValue({ statusCode: 201 });

    await sendWebPush(aBrowser, aPayload, keys, send);

    expect(send.mock.calls[0]?.[1]).toBe(JSON.stringify(aPayload));
  });

  it('says a subscription is finished when the push service says it is gone', async () => {
    expect(await sendWebPush(aBrowser, aPayload, keys, refusing(410))).toBe('gone');
    expect(await sendWebPush(aBrowser, aPayload, keys, refusing(404))).toBe('gone');
  });

  it('does not throw away a subscription over a push service having a bad day', async () => {
    expect(await sendWebPush(aBrowser, aPayload, keys, refusing(503))).toBe('failed');
  });

  it('does not throw, so one phone cannot stop everybody else being told', async () => {
    const exploding = vi.fn<WebPushSender>().mockRejectedValue(new Error('boom'));

    await expect(sendWebPush(aBrowser, aPayload, keys, exploding)).resolves.toBe('failed');
  });

  it('treats a refusal without a status as a failure rather than as gone', async () => {
    const vague = vi.fn<WebPushSender>().mockRejectedValue(new Error('who knows'));

    expect(await sendWebPush(aBrowser, aPayload, keys, vague)).toBe('failed');
  });
});
