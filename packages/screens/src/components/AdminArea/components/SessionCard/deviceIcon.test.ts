import { Compass01Icon, Globe02Icon, Tv01Icon } from '@hugeicons/core-free-icons';
import { describe, expect, it } from 'vitest';
import { deviceIconFor } from './deviceIcon';
describe('deviceIconFor', () => {
  it('picks the browser a label starts with', () => {
    expect(deviceIconFor('Chromium on macOS')).toBe(Globe02Icon);
  });

  it('tells one browser apart from another', () => {
    expect(deviceIconFor('Firefox on Linux')).toBe(Globe02Icon);
  });

  it('gives Safari its own mark, the one browser the set can still draw honestly', () => {
    expect(deviceIconFor('Safari on iOS')).toBe(Compass01Icon);
  });

  it('falls back to a plain device icon for a label it does not recognise', () => {
    expect(deviceIconFor('Unknown device')).toBe(Tv01Icon);
  });
});
