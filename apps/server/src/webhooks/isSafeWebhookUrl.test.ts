import { describe, expect, it } from 'vitest';
import { isSafeWebhookUrl } from './isSafeWebhookUrl';

describe('isSafeWebhookUrl', () => {
  it('allows an ordinary receiver on the internet', () => {
    expect(isSafeWebhookUrl('https://discord.com/api/webhooks/1/abc')).toBe(true);
  });

  it('allows ntfy on the same box, which is the common setup', () => {
    expect(isSafeWebhookUrl('http://localhost:2586/valence')).toBe(true);
    expect(isSafeWebhookUrl('http://127.0.0.1:2586/valence')).toBe(true);
    expect(isSafeWebhookUrl('http://[::1]:2586/valence')).toBe(true);
  });

  it('allows something across the landing', () => {
    expect(isSafeWebhookUrl('http://192.168.1.40:8123/api/webhook/valence')).toBe(true);
    expect(isSafeWebhookUrl('http://10.0.0.5/hook')).toBe(true);
    expect(isSafeWebhookUrl('http://172.16.4.4/hook')).toBe(true);
  });

  it('refuses the address a provider hands credentials out on', () => {
    expect(isSafeWebhookUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
  });

  it('refuses the rest of the link-local range, not just that one address', () => {
    expect(isSafeWebhookUrl('http://169.254.1.1/')).toBe(false);
    expect(isSafeWebhookUrl('http://169.254.0.0/')).toBe(false);
  });

  it('refuses the metadata service by name as well as by address', () => {
    expect(isSafeWebhookUrl('http://metadata.google.internal/computeMetadata/v1/')).toBe(false);
    expect(isSafeWebhookUrl('http://METADATA.GOOGLE.INTERNAL/')).toBe(false);
  });

  it('refuses link-local written as IPv6', () => {
    expect(isSafeWebhookUrl('http://[fe80::1]/hook')).toBe(false);
    expect(isSafeWebhookUrl('http://[FE80::1]/hook')).toBe(false);
    expect(isSafeWebhookUrl('http://[febf::1]/hook')).toBe(false);
  });

  it('refuses link-local wearing an IPv4 suffix', () => {
    expect(isSafeWebhookUrl('http://[::ffff:169.254.169.254]/')).toBe(false);
  });

  it('refuses a scheme that is not http', () => {
    expect(isSafeWebhookUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeWebhookUrl('gopher://example.com/')).toBe(false);
  });

  it('refuses something that is not a url at all', () => {
    expect(isSafeWebhookUrl('not a url')).toBe(false);
    expect(isSafeWebhookUrl('')).toBe(false);
  });
});
