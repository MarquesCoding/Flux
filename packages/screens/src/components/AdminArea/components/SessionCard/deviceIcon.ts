import { CompassIcon, GlobeIcon, Tv01Icon } from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';

const BROWSERS = ['Edge', 'Opera', 'Chromium', 'Chrome', 'Firefox'] as const;

/**
 * Picks the icon for a device from what its label starts with, so a list of sessions can be read by
 * shape as well as by name.
 *
 * It used to name the browser — a Chrome mark for Chrome, a Firefox mark for Firefox. The icon set
 * carries no brand marks, so the distinction it can still draw honestly is the one that matters
 * more anyway: something browsing, or something in the corner of a room. The browser's own name is
 * written beside it either way.
 *
 * @param deviceLabel - What the session calls the device.
 * @returns The icon to draw.
 */
const deviceIconFor = (deviceLabel: string): IconSvgElement => {
  if (deviceLabel.startsWith('Safari')) {
    return CompassIcon;
  }

  return BROWSERS.some((name) => deviceLabel.startsWith(name)) ? GlobeIcon : Tv01Icon;
};

export { deviceIconFor };
