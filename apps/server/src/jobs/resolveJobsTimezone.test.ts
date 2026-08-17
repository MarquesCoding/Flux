import { describe, expect, it } from 'vitest';
import { resolveJobsTimezone } from './resolveJobsTimezone';

describe('resolveJobsTimezone', () => {
  it('takes what the operator set, over anything detected', () => {
    expect(
      resolveJobsTimezone({
        configured: 'America/Phoenix',
        environment: 'Europe/London',
        host: 'Asia/Tokyo',
      }),
    ).toBe('America/Phoenix');
  });

  it('takes TZ when nothing is configured, which is how a container is told where it lives', () => {
    expect(resolveJobsTimezone({ configured: '', environment: 'Europe/London', host: 'UTC' })).toBe(
      'Europe/London',
    );
  });

  it('falls back to the host, which is right for a native install', () => {
    expect(
      resolveJobsTimezone({ configured: '', environment: undefined, host: 'Europe/London' }),
    ).toBe('Europe/London');
  });

  it('ends at UTC, which is what pg-boss assumed before any of this', () => {
    expect(resolveJobsTimezone({ configured: '', environment: undefined, host: undefined })).toBe(
      'UTC',
    );
  });

  it('skips a source that names a zone which does not exist', () => {
    expect(
      resolveJobsTimezone({
        configured: 'Not/AZone',
        environment: undefined,
        host: 'Europe/London',
      }),
    ).toBe('Europe/London');
  });

  it('skips a fixed offset rather than storing a schedule against one', () => {
    expect(
      resolveJobsTimezone({ configured: '+01:00', environment: undefined, host: 'Europe/London' }),
    ).toBe('Europe/London');
  });
});
