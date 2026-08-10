import { describe, expect, it, vi } from 'vitest'
import MetadataProviderModule from './MetadataProvider'
import createFilenameMetadataProviderModule from './createFilenameMetadataProvider'
import type { MediaFacts, MetadataProvider } from './MetadataProvider'
import type { MediaProbe } from '@FluxServer/transcoder/TranscoderClient'

const { resolveMetadata } = MetadataProviderModule
const { createFilenameMetadataProvider } = createFilenameMetadataProviderModule

const probe: MediaProbe = {
  container: 'mkv',
  durationSeconds: 7200,
  bitrateKbps: 12000,
  video: null,
  audioStreams: [],
  subtitleStreams: [],
  chapters: [],
}

const facts = (path: string): MediaFacts => ({ path, probe })

const provider = (name: string, answer: { title: string; year: number | null } | null) => ({
  name,
  describe: () => Promise.resolve(answer),
})

describe('resolveMetadata', () => {
  it('takes the first answer', async () => {
    const providers: MetadataProvider[] = [
      provider('plugin', { title: 'Arrival', year: 2016 }),
      provider('filename', { title: 'arrival.2016', year: null }),
    ]

    await expect(resolveMetadata(providers, facts('/a.mkv'))).resolves.toMatchObject({
      title: 'Arrival',
    })
  })

  it('falls through a provider that knows nothing', async () => {
    const providers: MetadataProvider[] = [
      provider('plugin', null),
      provider('filename', { title: 'Arrival', year: 2016 }),
    ]

    await expect(resolveMetadata(providers, facts('/a.mkv'))).resolves.toMatchObject({
      title: 'Arrival',
    })
  })

  it('skips a provider that fails rather than failing the scan', async () => {
    const broken: MetadataProvider = {
      name: 'plugin',
      describe: () => Promise.reject(new Error('TMDB is down')),
    }

    const providers = [broken, provider('filename', { title: 'Arrival', year: 2016 })]

    await expect(resolveMetadata(providers, facts('/a.mkv'))).resolves.toMatchObject({
      title: 'Arrival',
    })
  })

  it('reports why a provider failed', async () => {
    const onProblem = vi.fn()
    const broken: MetadataProvider = {
      name: 'plugin',
      describe: () => Promise.reject(new Error('TMDB is down')),
    }

    await resolveMetadata([broken], facts('/a.mkv'), onProblem)

    expect(onProblem).toHaveBeenCalledWith('plugin', 'TMDB is down')
  })

  it('reports nothing when no provider knows', async () => {
    await expect(resolveMetadata([provider('plugin', null)], facts('/a.mkv'))).resolves.toBeNull()
  })
})

describe('the filename provider', () => {
  it('always answers, so it can sit last in the list', async () => {
    const found = await createFilenameMetadataProvider().describe(
      facts('/media/Arrival (2016).mkv'),
    )

    expect(found).toMatchObject({ title: 'Arrival', year: 2016 })
  })
})
