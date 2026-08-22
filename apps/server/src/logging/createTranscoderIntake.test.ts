import { describe, expect, it } from 'vitest';
import { createTranscoderIntake } from './createTranscoderIntake';
import type { Logger } from './Logger';
import type { LogLevel, LogSource } from '@ValenceContracts/schemas/Log';

const createSpy = () => {
  const written: { level: LogLevel; source: LogSource; message: string }[] = [];

  const at =
    (level: LogLevel) =>
    (source: LogSource, message: string): void => {
      written.push({ level, source, message });
    };

  const logger: Logger = {
    debug: at('debug'),
    info: at('info'),
    warn: at('warn'),
    error: at('error'),
    about: () => logger,
    flush: () => Promise.resolve(),
  };

  return { logger, written };
};

const aReport = (lines: { atMs: number; level: string; source: string; message: string }[]) => ({
  logs: lines,
});

describe('createTranscoderIntake', () => {
  it('takes a line the media service reported', () => {
    const spy = createSpy();
    const intake = createTranscoderIntake(spy.logger);

    intake.take(aReport([{ atMs: 10, level: 'error', source: 'transcode', message: 'failed' }]));

    expect(spy.written).toHaveLength(1);
  });

  it('marks it as coming from the media service', () => {
    const spy = createSpy();
    const intake = createTranscoderIntake(spy.logger);

    intake.take(aReport([{ atMs: 10, level: 'error', source: 'transcode', message: 'failed' }]));

    expect(spy.written[0]?.source).toBe('transcoder');
  });

  it('keeps which part of the media service spoke', () => {
    const spy = createSpy();
    const intake = createTranscoderIntake(spy.logger);

    intake.take(aReport([{ atMs: 10, level: 'error', source: 'transcode', message: 'failed' }]));

    expect(spy.written[0]?.message).toBe('transcode: failed');
  });

  it('keeps how serious the media service said it was', () => {
    const spy = createSpy();
    const intake = createTranscoderIntake(spy.logger);

    intake.take(aReport([{ atMs: 10, level: 'warn', source: 'preview', message: 'retrying' }]));

    expect(spy.written[0]?.level).toBe('warn');
  });

  it('does not take the same line twice, since the window is resent every reading', () => {
    const spy = createSpy();
    const intake = createTranscoderIntake(spy.logger);
    const report = aReport([{ atMs: 10, level: 'error', source: 'transcode', message: 'failed' }]);

    intake.take(report);
    intake.take(report);

    expect(spy.written).toHaveLength(1);
  });

  it('takes a line that arrived after the last one it saw', () => {
    const spy = createSpy();
    const intake = createTranscoderIntake(spy.logger);

    intake.take(aReport([{ atMs: 10, level: 'info', source: 'session', message: 'one' }]));
    intake.take(
      aReport([
        { atMs: 10, level: 'info', source: 'session', message: 'one' },
        { atMs: 20, level: 'info', source: 'session', message: 'two' },
      ]),
    );

    expect(spy.written.map((one) => one.message)).toStrictEqual(['session: one', 'session: two']);
  });

  it('takes lines oldest first, since the media service sends them newest first', () => {
    const spy = createSpy();
    const intake = createTranscoderIntake(spy.logger);

    intake.take(
      aReport([
        { atMs: 20, level: 'info', source: 'session', message: 'second' },
        { atMs: 10, level: 'info', source: 'session', message: 'first' },
      ]),
    );

    expect(spy.written.map((one) => one.message)).toStrictEqual([
      'session: first',
      'session: second',
    ]);
  });

  it('ignores a reading with no log in it at all', () => {
    const spy = createSpy();
    const intake = createTranscoderIntake(spy.logger);

    intake.take({ resources: { systemCpuPercent: 12 } });

    expect(spy.written).toStrictEqual([]);
  });

  it('ignores a reading it cannot read rather than throwing on the relay', () => {
    const spy = createSpy();
    const intake = createTranscoderIntake(spy.logger);

    intake.take({ logs: 'not a list' });

    expect(spy.written).toStrictEqual([]);
  });

  it('ignores a line missing what it needs', () => {
    const spy = createSpy();
    const intake = createTranscoderIntake(spy.logger);

    intake.take({ logs: [{ atMs: 10, message: 'no level or source' }] });

    expect(spy.written).toStrictEqual([]);
  });

  it('keeps taking after a reading it could not read', () => {
    const spy = createSpy();
    const intake = createTranscoderIntake(spy.logger);

    intake.take({ logs: 'not a list' });
    intake.take(aReport([{ atMs: 10, level: 'error', source: 'transcode', message: 'failed' }]));

    expect(spy.written).toHaveLength(1);
  });
});
