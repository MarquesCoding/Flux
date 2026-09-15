import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createSidecarSubtitleService } from './createSidecarSubtitleService';

const MEDIA_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

const SUB_RIP = '1\n00:00:01,000 --> 00:00:03,000\nHello\n';

const library = async (
  files: Record<string, string | Uint8Array>,
  onProblem?: (path: string, reason: string) => void,
) => {
  const root = await mkdtemp(join(tmpdir(), 'valence-subs-'));
  const video = join(root, 'Arrival (2016).mkv');

  await writeFile(video, 'not really a film');

  for (const [name, contents] of Object.entries(files)) {
    const path = join(root, name);

    if (name.includes('/')) {
      await mkdir(join(root, name.slice(0, name.lastIndexOf('/'))), { recursive: true });
    }

    await writeFile(path, contents);
  }

  const service = createSidecarSubtitleService({
    media: { findPath: () => Promise.resolve(video) },
    ...(onProblem === undefined ? {} : { onProblem }),
  });

  return { service, root, video };
};

describe('createSidecarSubtitleService', () => {
  it('lists the tracks sitting beside a film', async () => {
    const { service } = await library({
      'Arrival (2016).en.srt': SUB_RIP,
      'Arrival (2016).fr.srt': SUB_RIP,
    });

    const tracks = await service.list(MEDIA_ID);

    expect(tracks?.map((track) => track.label)).toEqual(['English', 'Français']);
  });

  it('finds tracks hidden in a Subs directory', async () => {
    const { service } = await library({ 'Subs/English.srt': SUB_RIP });

    const tracks = await service.list(MEDIA_ID);

    expect(tracks?.map((track) => track.label)).toEqual(['English']);
  });

  it('reads a track as WebVTT whatever it arrived as', async () => {
    const { service } = await library({ 'Arrival (2016).en.srt': SUB_RIP });

    const tracks = await service.list(MEDIA_ID);
    const track = await service.read(MEDIA_ID, tracks?.[0]?.id ?? '');

    expect(track?.startsWith('WEBVTT')).toBe(true);
    expect(track).toContain('00:00:01.000 --> 00:00:03.000');
    expect(track).toContain('Hello');
  });

  it('names a track the same way every time, so a link survives a restart', async () => {
    const { service } = await library({ 'Arrival (2016).en.srt': SUB_RIP });

    const first = await service.list(MEDIA_ID);
    const second = await service.list(MEDIA_ID);

    expect(first?.[0]?.id).toBe(second?.[0]?.id);
  });

  it('reports nothing for a track that does not exist', async () => {
    const { service } = await library({ 'Arrival (2016).en.srt': SUB_RIP });

    await expect(service.read(MEDIA_ID, 'nonsense')).resolves.toBeNull();
  });

  it('reports nothing for a film that does not exist', async () => {
    const service = createSidecarSubtitleService({
      media: { findPath: () => Promise.resolve(null) },
    });

    await expect(service.list(MEDIA_ID)).resolves.toBeNull();
  });

  it('answers with no tracks rather than failing when the folder cannot be read', async () => {
    const service = createSidecarSubtitleService({
      media: { findPath: () => Promise.resolve('/nowhere/at/all/film.mkv') },
    });

    await expect(service.list(MEDIA_ID)).resolves.toEqual([]);
  });

  it('reports why a track could not be read', async () => {
    const onProblem = vi.fn();
    const { service, root, video } = await library({ 'Arrival (2016).en.srt': SUB_RIP });
    const tracks = await service.list(MEDIA_ID);

    const broken = createSidecarSubtitleService({
      media: { findPath: () => Promise.resolve(video) },
      onProblem,
    });

    await writeFile(join(root, 'Arrival (2016).en.srt'), SUB_RIP);
    await mkdir(join(root, 'unreadable.en.srt'), { recursive: true });

    const withDirectory = await broken.list(MEDIA_ID);

    expect(withDirectory?.length).toBeGreaterThan(0);
    expect(tracks?.length).toBeGreaterThan(0);
  });

  it('converts an Advanced SubStation script, dropping its own styling', async () => {
    const { service } = await library({
      'Arrival (2016).en.ass': [
        '[Events]',
        'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
        'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,{\\pos(1,2)}Styled line',
      ].join('\n'),
    });

    const tracks = await service.list(MEDIA_ID);
    const track = await service.read(MEDIA_ID, tracks?.[0]?.id ?? '');

    expect(track).toContain('Styled line');
    expect(track).not.toContain('\\pos');
  });
});

describe('a subtitle directory holding a folder per video', () => {
  it('finds the tracks in the folder named after the film', async () => {
    const { service } = await library({ 'Subs/Arrival (2016)/English.srt': SUB_RIP });

    const tracks = await service.list(MEDIA_ID);

    expect(tracks?.map((track) => track.label)).toEqual(['English']);
  });

  it('leaves another video’s folder alone, which is what the folders are for', async () => {
    const { service } = await library({ 'Subs/Dune (2021)/English.srt': SUB_RIP });

    const tracks = await service.list(MEDIA_ID);

    expect(tracks).toEqual([]);
  });
});

describe('a subtitle Valence cannot draw', () => {
  it('says why it is not offered, rather than leaving an empty menu unexplained', async () => {
    const onProblem = vi.fn();
    const { service } = await library(
      { 'Arrival (2016).en.sup': 'not really a subtitle' },
      onProblem,
    );

    await service.list(MEDIA_ID);

    expect(onProblem).toHaveBeenCalledWith(
      expect.stringContaining('Arrival (2016).en.sup'),
      expect.stringContaining('pictures'),
    );
  });

  it('says nothing about one belonging to a different film', async () => {
    const onProblem = vi.fn();

    await (
      await library({ 'Dune (2021).en.sup': 'not really a subtitle' }, onProblem)
    ).service.list(MEDIA_ID);

    expect(onProblem).not.toHaveBeenCalled();
  });

  it('reads a sidecar that is not UTF-8 by what its name says it is', async () => {
    const cyrillic = Uint8Array.from([
      0x31, 0x0a, 0x30, 0x30, 0x3a, 0x30, 0x30, 0x3a, 0x30, 0x31, 0x2c, 0x30, 0x30, 0x30, 0x20,
      0x2d, 0x2d, 0x3e, 0x20, 0x30, 0x30, 0x3a, 0x30, 0x30, 0x3a, 0x30, 0x33, 0x2c, 0x30, 0x30,
      0x30, 0x0a, 0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2, 0x0a,
    ]);

    const { service } = await library({ 'Arrival (2016).ru.srt': cyrillic });
    const tracks = await service.list(MEDIA_ID);
    const read = await service.read(MEDIA_ID, tracks?.[0]?.id ?? '');

    expect(read).toContain('Привет');
    expect(read).not.toContain('\ufffd');
  });

  it('says which encoding it settled on, so a wrong answer can be seen', async () => {
    const onProblem = vi.fn();
    const { service, root } = await library(
      { 'Arrival (2016).ru.srt': Uint8Array.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]) },
      onProblem,
    );

    const tracks = await service.list(MEDIA_ID);

    await service.read(MEDIA_ID, tracks?.[0]?.id ?? '');

    expect(onProblem).toHaveBeenCalledWith(
      join(root, 'Arrival (2016).ru.srt'),
      'read as windows-1251 (from the track language; not valid UTF-8)',
    );
  });

  it('says nothing about a sidecar that really is UTF-8', async () => {
    const onProblem = vi.fn();
    const { service } = await library({ 'Arrival (2016).ru.srt': SUB_RIP }, onProblem);

    const tracks = await service.list(MEDIA_ID);

    await service.read(MEDIA_ID, tracks?.[0]?.id ?? '');

    expect(onProblem).not.toHaveBeenCalled();
  });
});
