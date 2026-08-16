import {
  RiChromeLine,
  RiEdgeNewLine,
  RiFirefoxLine,
  RiOperaFill,
  RiSafariLine,
  RiTvFill,
} from '@remixicon/react';
import type { RemixiconComponentType } from '@remixicon/react';

type Match = { prefix: string; icon: RemixiconComponentType };

const MATCHES: Match[] = [
  { prefix: 'Edge', icon: RiEdgeNewLine },
  { prefix: 'Opera', icon: RiOperaFill },
  { prefix: 'Chromium', icon: RiChromeLine },
  { prefix: 'Firefox', icon: RiFirefoxLine },
  { prefix: 'Safari', icon: RiSafariLine },
];

/**
 * Picks the icon for a device from what its label starts with, so a list of sessions can be read by
 * shape rather than by name. Matched in order, since a Chromium-based browser names itself after
 * both itself and Chromium and the more specific of the two is the useful one.
 *
 * @param deviceLabel - What the session calls the device.
 * @returns The icon to draw, or a plain device icon where nothing is recognised.
 */
const deviceIconFor = (deviceLabel: string): RemixiconComponentType =>
  MATCHES.find((candidate) => deviceLabel.startsWith(candidate.prefix))?.icon ?? RiTvFill;

export { deviceIconFor };
