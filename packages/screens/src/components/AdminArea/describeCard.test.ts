import { describe, expect, it } from 'vitest';
import { describeCard } from './describeCard';

describe('describeCard', () => {
  it('says there is nothing to name where no card could be read', () => {
    expect(describeCard(null)).toBe('None Valence can read');
  });

  it('names a card that answered about its encoder and leaves it at that', () => {
    expect(
      describeCard({
        name: 'NVIDIA GeForce RTX 4070',
        encoderPercent: 88,
        devicePercent: 34,
        measured: 'wholeMachine',
      }),
    ).toBe('NVIDIA GeForce RTX 4070');
  });

  it('says which question a card would not answer', () => {
    expect(
      describeCard({
        name: 'Apple M5 Pro',
        encoderPercent: null,
        devicePercent: 41,
        measured: 'wholeMachine',
      }),
    ).toBe('Apple M5 Pro · encoder not readable');
  });

  it('never lets a figure covering our own work read as one covering the card', () => {
    expect(
      describeCard({
        name: 'Intel UHD Graphics 770',
        encoderPercent: 62,
        devicePercent: null,
        measured: 'valenceOnly',
      }),
    ).toBe("Intel UHD Graphics 770 · Valence's own work only");
  });

  it('names a card it has measured nothing on yet', () => {
    expect(
      describeCard({
        name: 'Intel UHD Graphics 770',
        encoderPercent: null,
        devicePercent: null,
        measured: 'valenceOnly',
      }),
    ).toBe("Intel UHD Graphics 770 · Valence's own work only");
  });
});
