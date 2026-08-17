import { describe, expect, it } from 'vitest';
import { describeLogDay, describeLogTime } from './describeLogTime';

describe('describeLogTime', () => {
  it('says the time to the second, since two log lines a minute apart are not the same moment', () => {
    expect(describeLogTime(Date.UTC(2026, 7, 17, 2, 30, 45))).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('reads on a twenty-four hour clock, so 13:05 is not mistaken for 01:05', () => {
    expect(describeLogTime(Date.UTC(2026, 7, 17, 13, 5, 0))).not.toMatch(/[ap]m/i);
  });

  it('agrees with the reader s own clock rather than the server s', () => {
    const at = Date.UTC(2026, 7, 17, 2, 30, 45);
    const local = new Date(at);

    expect(describeLogTime(at)).toContain(local.getHours().toString().padStart(2, '0'));
  });

  it('says something for the beginning of time rather than throwing', () => {
    expect(describeLogTime(0)).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});

describe('describeLogDay', () => {
  it('says the day, for telling last night s scan from this morning s', () => {
    expect(describeLogDay(Date.UTC(2026, 7, 17, 12, 0, 0))).toContain('2026');
  });

  it('gives two different days two different answers', () => {
    const one = describeLogDay(Date.UTC(2026, 7, 17, 12, 0, 0));
    const other = describeLogDay(Date.UTC(2026, 7, 18, 12, 0, 0));

    expect(one).not.toBe(other);
  });
});
