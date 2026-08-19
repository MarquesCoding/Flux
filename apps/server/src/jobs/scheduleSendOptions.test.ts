import { describe, expect, it } from 'vitest';
import { scheduleSendOptions } from './scheduleSendOptions';

describe('scheduleSendOptions', () => {
  it('registers the cron under the trigger it came from', () => {
    expect(scheduleSendOptions('library.scan.schedule', 'trigger-1', 'Europe/London').key).toBe(
      'trigger-1',
    );
  });

  it('reads the cron in the zone it was given', () => {
    expect(scheduleSendOptions('library.scan.schedule', 'trigger-1', 'Europe/London').tz).toBe(
      'Europe/London',
    );
  });

  it('collapses a tick into whatever is already waiting rather than stacking beside it', () => {
    expect(
      scheduleSendOptions('library.scan.schedule', 'trigger-1', 'UTC').singletonKey,
    ).toBeDefined();
  });

  it('keys on the work rather than on the trigger, so two triggers for one job still leave one waiting', () => {
    const nightly = scheduleSendOptions('library.scan.schedule', 'trigger-nightly', 'UTC');
    const hourly = scheduleSendOptions('library.scan.schedule', 'trigger-hourly', 'UTC');

    expect(nightly.singletonKey).toBe(hourly.singletonKey);
    expect(nightly.key).not.toBe(hourly.key);
  });

  it('keeps different work apart, so previews waiting does not hold a scan back', () => {
    const scan = scheduleSendOptions('library.scan.schedule', 'a', 'UTC');
    const previews = scheduleSendOptions('library.regeneratePreviews.schedule', 'b', 'UTC');

    expect(scan.singletonKey).not.toBe(previews.singletonKey);
  });
});
