import { describe, expect, it } from 'vitest';
import { describeWhen } from './describeWhen';

const NOW = new Date('2026-08-14T12:00:00.000Z');

const ago = (milliseconds: number) => new Date(NOW.getTime() - milliseconds);

describe('saying when something was watched', () => {
  it('calls the last minute just now', () => {
    expect(describeWhen(ago(30_000), NOW)).toBe('Just now');
  });

  it('counts minutes within the hour', () => {
    expect(describeWhen(ago(20 * 60_000), NOW)).toBe('20 min ago');
  });

  it('says an hour rather than one hour', () => {
    expect(describeWhen(ago(90 * 60_000), NOW)).toBe('An hour ago');
  });

  it('counts hours within the day', () => {
    expect(describeWhen(ago(5 * 3_600_000), NOW)).toBe('5 hours ago');
  });

  it('calls the day before yesterday', () => {
    expect(describeWhen(ago(30 * 3_600_000), NOW)).toBe('Yesterday');
  });

  it('counts days within the week', () => {
    expect(describeWhen(ago(4 * 86_400_000), NOW)).toBe('4 days ago');
  });

  it('gives a date once counting days stops helping', () => {
    expect(describeWhen(ago(30 * 86_400_000), NOW)).toMatch(/Jul/);
  });

  it('leaves the year off when it is this one', () => {
    expect(describeWhen(ago(30 * 86_400_000), NOW)).not.toMatch(/2026/);
  });

  it('gives the year once it is a different one', () => {
    expect(describeWhen(new Date('2024-03-12T09:00:00.000Z'), NOW)).toMatch(/2024/);
  });

  it('does not read a clock running ahead as far in the past', () => {
    expect(describeWhen(new Date(NOW.getTime() + 60_000), NOW)).toBe('Just now');
  });
});
