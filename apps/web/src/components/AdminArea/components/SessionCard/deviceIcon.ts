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
 * The icon a device label starts with, or a plain device icon for one that names nothing
 * recognised.
 */
const deviceIconFor = (deviceLabel: string): RemixiconComponentType =>
  MATCHES.find((candidate) => deviceLabel.startsWith(candidate.prefix))?.icon ?? RiTvFill;

export { deviceIconFor };
