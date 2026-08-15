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

/**
 * Checked in this order for the same reason `detectClientLabel` builds its
 * label in this order: Edge and Opera's own labels still start with a name
 * a laxer check would mistake for Chrome.
 */
const MATCHES: Match[] = [
  { prefix: 'Edge', icon: RiEdgeNewLine },
  { prefix: 'Opera', icon: RiOperaFill },
  { prefix: 'Chromium', icon: RiChromeLine },
  { prefix: 'Firefox', icon: RiFirefoxLine },
  { prefix: 'Safari', icon: RiSafariLine },
];

/**
 * The icon a device label starts with, or a plain device icon for one that
 * names nothing recognised.
 *
 * Reads a label rather than a user agent because presence only ever carries
 * the label `detectClientLabel` already built — asking twice would mean
 * agreeing with itself on two separate parses.
 */
const deviceIconFor = (deviceLabel: string): RemixiconComponentType =>
  MATCHES.find((candidate) => deviceLabel.startsWith(candidate.prefix))?.icon ?? RiTvFill;

export { deviceIconFor };
