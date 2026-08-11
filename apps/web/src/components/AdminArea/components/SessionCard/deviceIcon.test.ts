import { IconBrandChrome, IconBrandFirefox, IconDeviceTvFilled } from '@tabler/icons-react';
import { describe, expect, it } from 'vitest';
import { deviceIconFor } from './deviceIcon';
describe('deviceIconFor', () => {
  it('picks the browser a label starts with', () => {
    expect(deviceIconFor('Chromium on macOS')).toBe(IconBrandChrome);
  });

  it('tells one browser apart from another', () => {
    expect(deviceIconFor('Firefox on Linux')).toBe(IconBrandFirefox);
  });

  it('falls back to a plain device icon for a label it does not recognise', () => {
    expect(deviceIconFor('Unknown device')).toBe(IconDeviceTvFilled);
  });
});
