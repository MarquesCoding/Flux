import { describe, expect, it } from 'vitest';
import { describeGraphics } from './describeGraphics';

describe('describeGraphics', () => {
  it('says there is nothing to read when no card answered', () => {
    expect(describeGraphics(null)).toEqual({ value: '—', detail: 'No card Valence can read' });
  });

  it('reports the encode block where the card names it', () => {
    const tile = describeGraphics({
      name: 'NVIDIA GeForce RTX 4070',
      encoderPercent: 88,
      devicePercent: 34,
      measured: 'wholeMachine' as const,
    });

    expect(tile.value).toBe('88%');
    expect(tile.detail).toBe('encoder, not whole card');
  });

  it('prefers the encoder to the card, since they answer different questions', () => {
    const tile = describeGraphics({
      name: 'Card',
      encoderPercent: 90,
      devicePercent: 5,
      measured: 'wholeMachine' as const,
    });

    expect(tile.value).toBe('90%');
  });

  it('falls back to the whole card and says that is what it is', () => {
    const tile = describeGraphics({
      name: 'Apple M5 Pro',
      encoderPercent: null,
      devicePercent: 41,
      measured: 'wholeMachine' as const,
    });

    expect(tile.value).toBe('41%');
    expect(tile.detail).toBe('whole card, not encoder');
  });

  it('never reports an unreadable encoder as an idle one', () => {
    const tile = describeGraphics({
      name: 'Apple M5 Pro',
      encoderPercent: null,
      devicePercent: 0,
      measured: 'wholeMachine' as const,
    });

    expect(tile.detail).toBe('whole card, not encoder');
    expect(tile.detail).not.toContain('encoder ·');
  });

  it('keeps every detail short enough for the one line a tile gives it', () => {
    const readings = [
      null,
      {
        name: 'NVIDIA GeForce RTX 4070 Ti Super',
        encoderPercent: 88,
        devicePercent: 34,
        measured: 'wholeMachine' as const,
      },
      {
        name: 'Apple M5 Pro',
        encoderPercent: null,
        devicePercent: 41,
        measured: 'wholeMachine' as const,
      },
      {
        name: 'A card with a very long name indeed',
        encoderPercent: null,
        devicePercent: null,
        measured: 'wholeMachine' as const,
      },
      {
        name: 'Intel UHD Graphics 770',
        encoderPercent: 62,
        devicePercent: null,
        measured: 'valenceOnly' as const,
      },
    ];

    for (const reading of readings) {
      expect(describeGraphics(reading).detail?.length ?? 0).toBeLessThanOrEqual(24);
    }
  });

  it('says nothing rather than zero when a card answers with neither figure', () => {
    const tile = describeGraphics({
      name: 'Some card',
      encoderPercent: null,
      devicePercent: null,
      measured: 'wholeMachine' as const,
    });

    expect(tile.value).toBe('—');
    expect(tile.detail).toBe('Nothing readable');
  });

  it('draws the bar from the figure it decided to show', () => {
    expect(
      describeGraphics({
        name: 'C',
        encoderPercent: 50,
        devicePercent: 10,
        measured: 'wholeMachine' as const,
      }).fraction,
    ).toBe(0.5);
    expect(
      describeGraphics({
        name: 'C',
        encoderPercent: null,
        devicePercent: 10,
        measured: 'wholeMachine' as const,
      }).fraction,
    ).toBe(0.1);
  });

  it('leaves the bar off a tile with no figure to draw', () => {
    expect(describeGraphics(null).fraction).toBeUndefined();
  });

  it('says a figure is the video engine rather than the card where that is what it measured', () => {
    const tile = describeGraphics({
      name: 'Intel UHD Graphics 770',
      encoderPercent: 62,
      devicePercent: null,
      measured: 'valenceOnly' as const,
    });

    expect(tile.value).toBe('62%');
    expect(tile.detail).toBe('video engine, ours only');
  });

  it('never labels our own share of an engine as the encoder block itself', () => {
    expect(
      describeGraphics({
        name: 'Intel UHD Graphics 770',
        encoderPercent: 0,
        devicePercent: null,
        measured: 'valenceOnly' as const,
      }).detail,
    ).not.toBe('encoder, not whole card');
  });
});
