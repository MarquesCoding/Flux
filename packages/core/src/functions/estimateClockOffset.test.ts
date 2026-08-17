import { describe, expect, it } from 'vitest';
import {
  estimateClockOffset,
  measurementJitter,
  offsetOf,
  roundTripOf,
} from './estimateClockOffset';
import type { Reading } from './estimateClockOffset';

const exchange = (sentAtMs: number, serverAtMs: number, backAtMs: number): Reading => ({
  sentAtMs,
  serverAtMs,
  backAtMs,
});

describe('offsetOf', () => {
  it('reads no offset when the clocks agree and the trip is even', () => {
    expect(offsetOf(exchange(1000, 1050, 1100))).toBe(0);
  });

  it('reads the server as ahead when it is', () => {
    expect(offsetOf(exchange(1000, 5050, 1100))).toBe(4000);
  });

  it('reads the server as behind when it is', () => {
    expect(offsetOf(exchange(1000, -2950, 1100))).toBe(-4000);
  });

  it('does not mistake a slow trip for a clock difference', () => {
    expect(offsetOf(exchange(0, 500, 1000))).toBe(0);
  });
});

describe('roundTripOf', () => {
  it('measures how long the exchange took', () => {
    expect(roundTripOf(exchange(1000, 1050, 1300))).toBe(300);
  });
});

describe('estimateClockOffset', () => {
  it('answers zero before anything has been measured', () => {
    expect(estimateClockOffset([])).toBe(0);
  });

  it('takes a single exchange at face value', () => {
    expect(estimateClockOffset([exchange(1000, 5050, 1100)])).toBe(4000);
  });

  it('ignores one delayed packet rather than reading it as a clock jump', () => {
    const steady = [
      exchange(0, 1000, 100),
      exchange(200, 1200, 300),
      exchange(400, 1400, 500),
      exchange(600, 1600, 700),
    ];
    const withOutlier = [...steady, exchange(800, 9000, 900)];

    expect(estimateClockOffset(withOutlier)).toBe(estimateClockOffset(steady));
  });

  it('keeps only recent exchanges, so an old clock does not linger', () => {
    const old: Reading[] = [];
    const now: Reading[] = [];

    for (let index = 0; index < 12; index += 1) {
      old.push(exchange(index * 100, index * 100 + 9050, index * 100 + 100));
      now.push(exchange(2000 + index * 100, 2000 + index * 100 + 50, 2000 + index * 100 + 100));
    }

    expect(estimateClockOffset([...old, ...now])).toBe(0);
  });

  it('answers steadily when the readings are steady', () => {
    const readings = [exchange(0, 1000, 100), exchange(200, 1200, 300), exchange(400, 1400, 500)];

    expect(estimateClockOffset(readings)).toBe(950);
  });
});

describe('measurementJitter', () => {
  it('answers nothing before there is anything to compare', () => {
    expect(measurementJitter([])).toBe(0);
    expect(measurementJitter([exchange(0, 50, 100)])).toBe(0);
  });

  it('is small on a steady connection', () => {
    const steady = [exchange(0, 50, 100), exchange(200, 250, 300), exchange(400, 450, 500)];

    expect(measurementJitter(steady)).toBe(0);
  });

  it('is large on an unsteady one, so the dead band can widen', () => {
    const unsteady = [exchange(0, 50, 100), exchange(200, 250, 900), exchange(1000, 1050, 1100)];

    expect(measurementJitter(unsteady)).toBe(600);
  });
});
