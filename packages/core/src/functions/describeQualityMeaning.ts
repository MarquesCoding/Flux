import type { DownloadQuality } from '@ValenceContracts/schemas/Download';

const MEANINGS = {
  original: 'Exactly what is on the server. The best it gets, and by far the largest.',
  '2160p': 'Every pixel the film has, on a screen large enough to show them.',
  '1440p': 'Sharper than most streaming services. Only worth it on a big screen.',
  '1080p': 'About what a streaming service gives you. Looks great on a TV or a laptop.',
  '720p': 'Hard to tell apart from 1080p on a phone or a tablet.',
  '480p': 'Noticeably softer, still perfectly watchable. Good for a long flight.',
  '360p': 'For when space is tight and you mostly want to follow along.',
  '240p': 'For when space is very tight.',
  '144p': 'For when space is very tight.',
} as const satisfies Record<DownloadQuality, string>;

/**
 * What a rung means to look at, in words rather than in megabits.
 *
 * "1080p · 4.5 Mbps" tells somebody who thinks in bitrates everything and everybody else nothing,
 * and the people who most need help choosing are in the second group. The descriptions are anchored
 * to screens and situations rather than to adjectives, because "good quality" is not a fact anybody
 * can decide against — where "hard to tell apart from 1080p on a phone" is.
 *
 * @param quality - The rung, or the original.
 * @returns One sentence about what choosing it would look like.
 */
const describeQualityMeaning = (quality: DownloadQuality): string => MEANINGS[quality];

export { describeQualityMeaning };
