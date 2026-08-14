import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signWebhookPayload, WEBHOOK_SIGNATURE_PREFIX } from './signWebhookPayload';

const aBody = JSON.stringify({ event: 'job.failed' });

describe('signWebhookPayload', () => {
  it('says which digest it used', () => {
    expect(signWebhookPayload('whsec_1', aBody)).toMatch(/^sha256=[\da-f]{64}$/);
  });

  it('produces what a receiver computing the same digest would', () => {
    const expected = createHmac('sha256', 'whsec_1').update(aBody).digest('hex');

    expect(signWebhookPayload('whsec_1', aBody)).toBe(`${WEBHOOK_SIGNATURE_PREFIX}${expected}`);
  });

  it('signs the same body the same way twice', () => {
    expect(signWebhookPayload('whsec_1', aBody)).toBe(signWebhookPayload('whsec_1', aBody));
  });

  it('differs when the secret differs', () => {
    expect(signWebhookPayload('whsec_1', aBody)).not.toBe(signWebhookPayload('whsec_2', aBody));
  });

  it('differs when a single byte of the body differs', () => {
    const tampered = JSON.stringify({ event: 'job.failedx' });

    expect(signWebhookPayload('whsec_1', aBody)).not.toBe(signWebhookPayload('whsec_1', tampered));
  });
});
