import { z } from 'zod';

const MEDIA_KINDS = [
  'movie',
  'episode',
  'season',
  'series',
  'album',
  'song',
  'video',
  'book',
] as const;

const MediaKindSchema = z.enum(MEDIA_KINDS);

type MediaKind = (typeof MEDIA_KINDS)[number];

const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
  movie: 'Film',
  episode: 'Episode',
  season: 'Season',
  series: 'Series',
  album: 'Album',
  song: 'Song',
  video: 'Video',
  book: 'Book',
};

export { MEDIA_KIND_LABELS, MEDIA_KINDS, MediaKindSchema };

export type { MediaKind };
