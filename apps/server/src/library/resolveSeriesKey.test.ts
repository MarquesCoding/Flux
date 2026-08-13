import { describe, expect, it } from 'vitest';
import { resolveSeriesKey } from './resolveSeriesKey';

describe('resolveSeriesKey', () => {
  it('gives a film no programme, since a film is not a series of one', () => {
    expect(
      resolveSeriesKey({ externalId: '329', seriesFolder: '/media', seriesTitle: null }),
    ).toBeNull();
  });

  it('takes the catalogue’s id, which every episode of a programme shares', () => {
    const key = resolveSeriesKey({
      externalId: '2316',
      seriesFolder: '/media/The Office',
      seriesTitle: 'The Office',
    });

    expect(key).toBe('catalogue:2316');
  });

  it('keeps two programmes of one name apart when a catalogue names them', () => {
    const uk = resolveSeriesKey({
      externalId: '2996',
      seriesFolder: '/media/The Office (UK)',
      seriesTitle: 'The Office',
    });

    const us = resolveSeriesKey({
      externalId: '2316',
      seriesFolder: '/media/The Office (US)',
      seriesTitle: 'The Office',
    });

    expect(uk).not.toBe(us);
  });

  it('falls back to the folder, which is how they are told apart on disk', () => {
    const uk = resolveSeriesKey({
      externalId: null,
      seriesFolder: '/media/The Office (UK)',
      seriesTitle: 'The Office',
    });

    const us = resolveSeriesKey({
      externalId: null,
      seriesFolder: '/media/The Office (US)',
      seriesTitle: 'The Office',
    });

    expect(uk).not.toBe(us);
  });

  it('holds one programme together however its title is rewritten', () => {
    const before = resolveSeriesKey({
      externalId: '208067',
      seriesFolder: '/media/Yamada',
      seriesTitle: 'Yamada-kun to Lv999 no Koi wo Suru',
    });

    const after = resolveSeriesKey({
      externalId: '208067',
      seriesFolder: '/media/Yamada',
      seriesTitle: 'My Love Story with Yamada-kun at Lv999',
    });

    expect(after).toBe(before);
  });

  it('holds it together across a retitle by the folder too, when nothing named it', () => {
    const before = resolveSeriesKey({
      externalId: null,
      seriesFolder: '/media/Some Show',
      seriesTitle: 'Some Show',
    });

    const after = resolveSeriesKey({
      externalId: null,
      seriesFolder: '/media/Some Show',
      seriesTitle: 'Some Show (2024)',
    });

    expect(after).toBe(before);
  });

  it('prefers the catalogue to the folder, since a folder can be reorganised', () => {
    const filed = resolveSeriesKey({
      externalId: '2316',
      seriesFolder: '/media/TV/The Office',
      seriesTitle: 'The Office',
    });

    const refiled = resolveSeriesKey({
      externalId: '2316',
      seriesFolder: '/media/Comedy/The Office',
      seriesTitle: 'The Office',
    });

    expect(refiled).toBe(filed);
  });

  it('falls back to the title for a loose file with nothing else to go on', () => {
    expect(
      resolveSeriesKey({ externalId: null, seriesFolder: null, seriesTitle: 'Some Show' }),
    ).toBe('title:some show');
  });

  it('reads that last resort the same however a release capitalised it', () => {
    expect(
      resolveSeriesKey({ externalId: null, seriesFolder: null, seriesTitle: 'SOME SHOW' }),
    ).toBe(resolveSeriesKey({ externalId: null, seriesFolder: null, seriesTitle: 'Some Show' }));
  });

  it('treats an empty title as no programme at all', () => {
    expect(
      resolveSeriesKey({ externalId: '1', seriesFolder: '/media', seriesTitle: '' }),
    ).toBeNull();
  });

  it('ignores an empty catalogue id rather than keying every programme on it', () => {
    expect(
      resolveSeriesKey({ externalId: '', seriesFolder: '/media/Show', seriesTitle: 'Show' }),
    ).toBe('folder:/media/Show');
  });
});
