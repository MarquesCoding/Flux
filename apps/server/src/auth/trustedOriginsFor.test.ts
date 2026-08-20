import { describe, expect, it } from 'vitest';
import { trustedOriginsFor } from './trustedOriginsFor';

const settingsSaying = (trustedOrigins: readonly string[]) => ({
  read: () => Promise.resolve({ trustedOrigins }),
});

describe('trustedOriginsFor', () => {
  it('answers what the environment named', async () => {
    const origins = await trustedOriginsFor({
      configured: ['https://flux.example.com'],
      port: 8420,
      settings: settingsSaying([]),
    })();

    expect(origins).toContain('https://flux.example.com');
  });

  it('answers what an operator added afterwards', async () => {
    const origins = await trustedOriginsFor({
      configured: [],
      port: 8420,
      settings: settingsSaying(['https://added.later']),
    })();

    expect(origins).toContain('https://added.later');
  });

  it('answers both, rather than letting the stored settings hide the environment', async () => {
    const origins = await trustedOriginsFor({
      configured: ['http://localhost:5174'],
      port: 8420,
      settings: settingsSaying(['https://added.later']),
    })();

    expect(origins).toContain('http://localhost:5174');
    expect(origins).toContain('https://added.later');
  });


  it('reads the settings afresh, so an addition is obeyed without a restart', async () => {
    const stored = ['https://first.example'];
    const origins = trustedOriginsFor({
      configured: [],
      port: 8420,
      settings: { read: () => Promise.resolve({ trustedOrigins: stored }) },
    });

    expect(await origins()).toContain('https://first.example');

    stored.push('https://second.example');

    expect(await origins()).toContain('https://second.example');
  });

  it('says each origin once, however many places named it', async () => {
    const origins = await trustedOriginsFor({
      configured: ['https://flux.example.com'],
      port: 8420,
      settings: settingsSaying(['https://flux.example.com']),
    })();

    expect(origins.filter((one) => one === 'https://flux.example.com')).toHaveLength(1);
  });
});
