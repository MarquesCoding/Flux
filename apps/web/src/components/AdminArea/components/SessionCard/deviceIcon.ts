import {
  IconBrandChrome,
  IconBrandEdge,
  IconBrandFirefox,
  IconBrandOperaFilled,
  IconBrandSafari,
  IconDeviceTvFilled,
} from '@tabler/icons-react'

type Match = { prefix: string; icon: typeof IconDeviceTvFilled }

/**
 * Checked in this order for the same reason `detectClientLabel` builds its
 * label in this order: Edge and Opera's own labels still start with a name
 * a laxer check would mistake for Chrome.
 */
const MATCHES: Match[] = [
  { prefix: 'Edge', icon: IconBrandEdge },
  { prefix: 'Opera', icon: IconBrandOperaFilled },
  // Chromium has no icon of its own in this set, and Chrome's is the closest
  // thing to a generic Chromium-family mark.
  { prefix: 'Chromium', icon: IconBrandChrome },
  { prefix: 'Firefox', icon: IconBrandFirefox },
  { prefix: 'Safari', icon: IconBrandSafari },
]

/**
 * The icon a device label starts with, or a plain device icon for one that
 * names nothing recognised.
 *
 * Reads a label rather than a user agent because presence only ever carries
 * the label `detectClientLabel` already built — asking twice would mean
 * agreeing with itself on two separate parses.
 */
const deviceIconFor = (deviceLabel: string): typeof IconDeviceTvFilled =>
  MATCHES.find((candidate) => deviceLabel.startsWith(candidate.prefix))?.icon ?? IconDeviceTvFilled

export default { deviceIconFor }
