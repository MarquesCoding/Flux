import { describe, expect, it, vi } from 'vitest';
import { resolveMetadata, resolveSeriesShape } from './MetadataProvider';
import { createFilenameMetadataProvider } from './createFilenameMetadataProvider';
import type { MediaFacts, MetadataProvider } from './MetadataProvider';
import type { MediaProbe } from '@ValenceServer/transcoder/TranscoderClient';

const probe: MediaProbe = {
  container: 'mkv',
  durationSeconds: 7200,
  bitrateKbps: 12000,
  video: null,
  audioStreams: [],
  subtitleStreams: [],
  chapters: [],
};

const facts = (path: string): MediaFacts => ({ path, probe });

const provider = (name: string, answer: { title: string; year: number | null } | null) => ({
  name,
  describe: () => Promise.resolve(answer),
});

describe('resolveMetadata', () => {
  it('takes the first answer', async () => {
    const providers: MetadataProvider[] = [
      provider('plugin', { title: 'Arrival', year: 2016 }),
      provider('filename', { title: 'arrival.2016', year: null }),
    ];

    await expect(resolveMetadata(providers, facts('/a.mkv'))).resolves.toMatchObject({
      title: 'Arrival',
    });
  });

  it('falls through a provider that knows nothing', async () => {
    const providers: MetadataProvider[] = [
      provider('plugin', null),
      provider('filename', { title: 'Arrival', year: 2016 }),
    ];

    await expect(resolveMetadata(providers, facts('/a.mkv'))).resolves.toMatchObject({
      title: 'Arrival',
    });
  });

  it('skips a provider that fails rather than failing the scan', async () => {
    const broken: MetadataProvider = {
      name: 'plugin',
      describe: () => Promise.reject(new Error('TMDB is down')),
    };

    const providers = [broken, provider('filename', { title: 'Arrival', year: 2016 })];

    await expect(resolveMetadata(providers, facts('/a.mkv'))).resolves.toMatchObject({
      title: 'Arrival',
    });
  });

  it('reports why a provider failed', async () => {
    const onProblem = vi.fn();
    const broken: MetadataProvider = {
      name: 'plugin',
      describe: () => Promise.reject(new Error('TMDB is down')),
    };

    await resolveMetadata([broken], facts('/a.mkv'), onProblem);

    expect(onProblem).toHaveBeenCalledWith('plugin', 'TMDB is down');
  });

  it('reports nothing when no provider knows', async () => {
    await expect(resolveMetadata([provider('plugin', null)], facts('/a.mkv'))).resolves.toBeNull();
  });
});

describe('the filename provider', () => {
  it('always answers, so it can sit last in the list', async () => {
    const found = await createFilenameMetadataProvider().describe(
      facts('/media/Arrival (2016).mkv'),
    );

    expect(found).toMatchObject({ title: 'Arrival', year: 2016 });
  });
});

describe('resolveSeriesShape', () => {
  const SHAPE = { seasons: [{ seasonNumber: 1, episodeCount: 2, episodes: [] }] };

  const named = (name: string, describeSeries?: MetadataProvider['describeSeries']) => ({
    name,
    describe: () => Promise.resolve(null),
    ...(describeSeries === undefined ? {} : { describeSeries }),
  });

  it('takes the first shape a provider offers', async () => {
    const providers = [named('one', () => Promise.resolve(SHAPE))];

    await expect(resolveSeriesShape(providers, '5')).resolves.toEqual(SHAPE);
  });

  it('skips a provider that does not describe series at all', async () => {
    const providers = [named('filenames'), named('catalogue', () => Promise.resolve(SHAPE))];

    await expect(resolveSeriesShape(providers, '5')).resolves.toEqual(SHAPE);
  });

  it('asks the next one when a provider has nothing to say', async () => {
    const providers = [
      named('one', () => Promise.resolve(null)),
      named('two', () => Promise.resolve(SHAPE)),
    ];

    await expect(resolveSeriesShape(providers, '5')).resolves.toEqual(SHAPE);
  });

  it('reports a provider that failed and carries on', async () => {
    const problems: string[] = [];
    const providers = [
      named('one', () => Promise.reject(new Error('catalogue is down'))),
      named('two', () => Promise.resolve(SHAPE)),
    ];

    await expect(
      resolveSeriesShape(providers, '5', (provider, reason) => {
        problems.push(`${provider}: ${reason}`);
      }),
    ).resolves.toEqual(SHAPE);

    expect(problems).toEqual(['one: catalogue is down']);
  });

  it('describes a failure that was not an error as a provider failing', async () => {
    const problems: string[] = [];
    const providers = [
      named('one', () =>
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- The point of the test: a provider that rejects with something that is not an Error.
        Promise.reject({ why: 'a plain object' }),
      ),
    ];

    await resolveSeriesShape(providers, '5', (provider, reason) => {
      problems.push(`${provider}: ${reason}`);
    });

    expect(problems).toEqual(['one: Provider failed.']);
  });

  it('has no shape when nothing could describe the series', async () => {
    await expect(resolveSeriesShape([named('filenames')], '5')).resolves.toBeNull();
  });
});
