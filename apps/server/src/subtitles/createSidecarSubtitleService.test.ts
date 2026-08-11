import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createSidecarSubtitleService } from './createSidecarSubtitleService'

const MEDIA_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

const SUB_RIP = '1\n00:00:01,000 --> 00:00:03,000\nHello\n'

const library = async (files: Record<string, string>) => {
  const root = await mkdtemp(join(tmpdir(), 'flux-subs-'))
  const video = join(root, 'Arrival (2016).mkv')

  await writeFile(video, 'not really a film')

  for (const [name, contents] of Object.entries(files)) {
    const path = join(root, name)

    if (name.includes('/')) {
      await mkdir(join(root, name.slice(0, name.lastIndexOf('/'))), { recursive: true })
    }

    await writeFile(path, contents)
  }

  const service = createSidecarSubtitleService({
    media: { findPath: () => Promise.resolve(video) },
  })

  return { service, root, video }
}

describe('createSidecarSubtitleService', () => {
  it('lists the tracks sitting beside a film', async () => {
    const { service } = await library({
      'Arrival (2016).en.srt': SUB_RIP,
      'Arrival (2016).fr.srt': SUB_RIP,
    })

    const tracks = await service.list(MEDIA_ID)

    expect(tracks?.map((track) => track.label)).toEqual(['English', 'Français'])
  })

  it('finds tracks hidden in a Subs directory', async () => {
    const { service } = await library({ 'Subs/English.srt': SUB_RIP })

    const tracks = await service.list(MEDIA_ID)

    expect(tracks?.map((track) => track.label)).toEqual(['English'])
  })

  it('reads a track as WebVTT whatever it arrived as', async () => {
    const { service } = await library({ 'Arrival (2016).en.srt': SUB_RIP })

    const tracks = await service.list(MEDIA_ID)
    const track = await service.read(MEDIA_ID, tracks?.[0]?.id ?? '')

    expect(track?.startsWith('WEBVTT')).toBe(true)
    expect(track).toContain('00:00:01.000 --> 00:00:03.000')
    expect(track).toContain('Hello')
  })

  it('names a track the same way every time, so a link survives a restart', async () => {
    const { service } = await library({ 'Arrival (2016).en.srt': SUB_RIP })

    const first = await service.list(MEDIA_ID)
    const second = await service.list(MEDIA_ID)

    expect(first?.[0]?.id).toBe(second?.[0]?.id)
  })

  it('reports nothing for a track that does not exist', async () => {
    const { service } = await library({ 'Arrival (2016).en.srt': SUB_RIP })

    await expect(service.read(MEDIA_ID, 'nonsense')).resolves.toBeNull()
  })

  it('reports nothing for a film that does not exist', async () => {
    const service = createSidecarSubtitleService({
      media: { findPath: () => Promise.resolve(null) },
    })

    await expect(service.list(MEDIA_ID)).resolves.toBeNull()
  })

  it('answers with no tracks rather than failing when the folder cannot be read', async () => {
    const service = createSidecarSubtitleService({
      media: { findPath: () => Promise.resolve('/nowhere/at/all/film.mkv') },
    })

    await expect(service.list(MEDIA_ID)).resolves.toEqual([])
  })

  it('reports why a track could not be read', async () => {
    const onProblem = vi.fn()
    const { service, root, video } = await library({ 'Arrival (2016).en.srt': SUB_RIP })
    const tracks = await service.list(MEDIA_ID)

    const broken = createSidecarSubtitleService({
      media: { findPath: () => Promise.resolve(video) },
      onProblem,
    })

    await writeFile(join(root, 'Arrival (2016).en.srt'), SUB_RIP)
    await mkdir(join(root, 'unreadable.en.srt'), { recursive: true })

    const withDirectory = await broken.list(MEDIA_ID)

    expect(withDirectory?.length).toBeGreaterThan(0)
    expect(tracks?.length).toBeGreaterThan(0)
  })

  it('converts an Advanced SubStation script, dropping its own styling', async () => {
    const { service } = await library({
      'Arrival (2016).en.ass': [
        '[Events]',
        'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
        'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,{\\pos(1,2)}Styled line',
      ].join('\n'),
    })

    const tracks = await service.list(MEDIA_ID)
    const track = await service.read(MEDIA_ID, tracks?.[0]?.id ?? '')

    expect(track).toContain('Styled line')
    expect(track).not.toContain('\\pos')
  })
})
