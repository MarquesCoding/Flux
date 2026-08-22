import { CompassIcon, GlobeIcon, TelevisionIcon } from '@phosphor-icons/react';
import { describe, expect, it } from 'vitest';
import { deviceIconFor } from './deviceIcon';
describe('deviceIconFor', () => {
  it('picks the browser a label starts with', () => {
    expect(deviceIconFor('Chromium on macOS')).toBe(GlobeIcon);
  });

  it('tells one browser apart from another', () => {
    expect(deviceIconFor('Firefox on Linux')).toBe(GlobeIcon);
  });

  it('gives Safari its own mark, the one browser the set can still draw honestly', () => {
    expect(deviceIconFor('Safari on iOS')).toBe(CompassIcon);
  });

  it('falls back to a plain device icon for a label it does not recognise', () => {
    expect(deviceIconFor('Unknown device')).toBe(TelevisionIcon);
  });
});
