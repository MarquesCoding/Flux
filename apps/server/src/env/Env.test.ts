import { describe, expect, it } from 'vitest';
import { readEnv } from './Env';

describe('readEnv', () => {
  it('applies defaults for an empty environment', () => {
    const env = readEnv({});

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(8420);
    expect(env.COOKIE_SECURE).toBe(false);
  });

  it('coerces the port from a string', () => {
    expect(readEnv({ PORT: '9000' }).PORT).toBe(9000);
  });

  it('splits trusted origins on commas and trims them', () => {
    const env = readEnv({ TRUSTED_ORIGINS: 'https://flux.example, http://192.168.1.40:8420' });

    expect(env.TRUSTED_ORIGINS).toEqual(['https://flux.example', 'http://192.168.1.40:8420']);
  });

  it('reads secure cookies as a boolean', () => {
    expect(readEnv({ COOKIE_SECURE: 'true' }).COOKIE_SECURE).toBe(true);
  });

  it('rejects a non-numeric port', () => {
    expect(() => readEnv({ PORT: 'http' })).toThrow();
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => readEnv({ NODE_ENV: 'staging' })).toThrow();
  });
});
