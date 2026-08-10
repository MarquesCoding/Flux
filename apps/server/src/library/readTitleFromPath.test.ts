import { describe, expect, it } from 'vitest'
import readTitleFromPathModule from './readTitleFromPath'

const { isMediaFile, readTitleFromPath } = readTitleFromPathModule

describe('isMediaFile', () => {
  it('accepts the containers Flux plays', () => {
    expect(isMediaFile('film.mkv')).toBe(true)
    expect(isMediaFile('film.mp4')).toBe(true)
    expect(isMediaFile('recording.ts')).toBe(true)
  })

  it('is case insensitive about the extension', () => {
    expect(isMediaFile('FILM.MKV')).toBe(true)
  })

  it('rejects the clutter that sits beside media', () => {
    expect(isMediaFile('poster.jpg')).toBe(false)
    expect(isMediaFile('film.nfo')).toBe(false)
    expect(isMediaFile('film.srt')).toBe(false)
    expect(isMediaFile('notes.txt')).toBe(false)
  })

  it('rejects hidden files', () => {
    expect(isMediaFile('.hidden.mkv')).toBe(false)
    expect(isMediaFile('._resource.mp4')).toBe(false)
  })

  it('rejects a file with no extension', () => {
    expect(isMediaFile('README')).toBe(false)
  })
})

describe('readTitleFromPath', () => {
  it('reads a plain title', () => {
    expect(readTitleFromPath('/media/films/Arrival.mkv')).toEqual({
      title: 'Arrival',
      year: null,
    })
  })

  it('reads a title and year', () => {
    expect(readTitleFromPath('/media/films/Arrival (2016).mkv')).toEqual({
      title: 'Arrival',
      year: 2016,
    })
  })

  it('reads a dotted release name', () => {
    expect(readTitleFromPath('Blade.Runner.2049.2017.2160p.UHD.BluRay.x265.mkv')).toEqual({
      title: 'Blade Runner 2049',
      year: 2017,
    })
  })

  it('drops quality and codec noise', () => {
    expect(readTitleFromPath('Dune Part Two 2024 1080p WEBRip x264 DTS.mkv').title).toBe(
      'Dune Part Two',
    )
  })

  it('handles bracketed tags', () => {
    expect(readTitleFromPath('[Group] Akira (1988) [1080p].mkv')).toEqual({
      title: 'Group Akira',
      year: 1988,
    })
  })

  it('keeps a number that is part of the title', () => {
    expect(readTitleFromPath('Blade Runner 2049 (2017).mkv').title).toBe('Blade Runner 2049')
  })

  it('ignores a year that is not plausible', () => {
    expect(readTitleFromPath('Film 1234.mkv').year).toBeNull()
  })

  it('falls back to the filename when nothing survives', () => {
    expect(readTitleFromPath('1080p.mkv').title).toBe('1080p')
  })

  it('uses only the final path segment', () => {
    expect(readTitleFromPath('/media/2019/films/Parasite (2019).mkv').title).toBe('Parasite')
  })
})
