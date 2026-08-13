import { describe, expect, it } from 'vitest';
import { pickLogo, rankLanguage } from './pickLogo';
import type { LogoCandidate } from './pickLogo';

const logo = (overrides: Partial<LogoCandidate> = {}): LogoCandidate => ({
  filePath: '/logo.png',
  language: 'en',
  width: 1000,
  voteAverage: 0,
  ...overrides,
});

describe('rankLanguage', () => {
  it('puts the viewer’s own language first', () => {
    expect(rankLanguage('en', 'en', 'ja')).toBe(0);
  });

  it('puts lettering that carries no words second, since anybody can read it', () => {
    expect(rankLanguage(null, 'en', 'ja')).toBeGreaterThan(rankLanguage('en', 'en', 'ja'));
    expect(rankLanguage(null, 'en', 'ja')).toBeLessThan(rankLanguage('ja', 'en', 'ja'));
  });

  it('prefers the tongue a programme was made in over some third language', () => {
    expect(rankLanguage('ja', 'en', 'ja')).toBeLessThan(rankLanguage('uk', 'en', 'ja'));
  });
});

describe('pickLogo', () => {
  it('has nothing to offer when a catalogue holds none', () => {
    expect(pickLogo([])).toBeNull();
  });

  it('takes the readable one over the better rated one', () => {
    const chosen = pickLogo(
      [
        logo({ filePath: '/ja.png', language: 'ja', width: 1232, voteAverage: 3.3 }),
        logo({ filePath: '/en.png', language: 'en', width: 1097, voteAverage: 0 }),
      ],
      { originalLanguage: 'ja' },
    );

    expect(chosen?.filePath).toBe('/en.png');
  });

  it('takes the larger of two equally readable ones', () => {
    const chosen = pickLogo([
      logo({ filePath: '/small.png', width: 600 }),
      logo({ filePath: '/big.png', width: 1097 }),
    ]);

    expect(chosen?.filePath).toBe('/big.png');
  });

  it('falls back to the programme’s own tongue rather than to nothing', () => {
    const chosen = pickLogo(
      [
        logo({ filePath: '/uk.png', language: 'uk', width: 2000 }),
        logo({ filePath: '/ja.png', language: 'ja', width: 900 }),
      ],
      { originalLanguage: 'ja' },
    );

    expect(chosen?.filePath).toBe('/ja.png');
  });

  it('uses the catalogue’s rating only to separate two that are otherwise equal', () => {
    const chosen = pickLogo([
      logo({ filePath: '/liked.png', width: 1000, voteAverage: 8 }),
      logo({ filePath: '/unrated.png', width: 1000, voteAverage: 0 }),
    ]);

    expect(chosen?.filePath).toBe('/liked.png');
  });

  it('answers with something rather than nothing when none of it is readable', () => {
    const chosen = pickLogo([logo({ filePath: '/uk.png', language: 'uk' })]);

    expect(chosen?.filePath).toBe('/uk.png');
  });
});
