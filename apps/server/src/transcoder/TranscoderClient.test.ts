import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';
import { readSocketPath, createTranscoderClient } from './TranscoderClient';

describe('readSocketPath', () => {
  it('reads a unix socket address', () => {
    expect(readSocketPath('unix:/run/valence-transcoder.sock')).toBe(
      '/run/valence-transcoder.sock',
    );
  });

  it('reports nothing for an http address', () => {
    expect(readSocketPath('http://127.0.0.1:8477')).toBeNull();
  });
});

describe('what the transcoder says it can do', () => {
  const answering = (body: JsonValue) =>
    createTranscoderClient({
      baseUrl: 'http://127.0.0.1:8477',
      fetchImpl: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: () => Promise.resolve(body),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        }),
    });

  const REPORTED = {
    ffmpegVersion: 'ffmpeg version 9.0',
    probeVersion: 1,
    encoders: [],
    hardwareAccels: [],
    toneMapping: 'zscale',
    canBurnTextSubtitles: true,
    canBurnImageSubtitles: true,
    chains: [],
  };

  it('keeps the tone mapping it was told about, rather than dropping it', async () => {
    const capabilities = await answering(REPORTED).capabilities();

    expect(capabilities.toneMapping).toBe('zscale');
  });

  it('keeps what it was told about burning in subtitles', async () => {
    const capabilities = await answering(REPORTED).capabilities();

    expect(capabilities.canBurnTextSubtitles).toBe(true);
    expect(capabilities.canBurnImageSubtitles).toBe(true);
  });

  it('assumes a transcoder that says nothing about tone mapping cannot do it', async () => {
    const capabilities = await answering({
      ffmpegVersion: 'ffmpeg version 9.0',
      probeVersion: 1,
      encoders: [],
      hardwareAccels: [],
    }).capabilities();

    expect(capabilities.toneMapping).toBe('unavailable');
  });
});

describe('createTranscoderClient', () => {
  it('addresses requests to the base url over http', async () => {
    const calls: string[] = [];

    const client = createTranscoderClient({
      baseUrl: 'http://127.0.0.1:8477',
      fetchImpl: (url) => {
        calls.push(url);

        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: () => Promise.resolve({ status: 'ok' }),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        });
      },
    });

    await client.isReachable();

    expect(calls[0]).toBe('http://127.0.0.1:8477/health');
  });

  it('uses a placeholder origin for socket requests, since a socket has none', async () => {
    const calls: string[] = [];

    const client = createTranscoderClient({
      baseUrl: 'unix:/run/valence-transcoder.sock',
      fetchImpl: (url) => {
        calls.push(url);

        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: () => Promise.resolve({ status: 'ok' }),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        });
      },
    });

    await client.isReachable();

    expect(calls[0]).toBe('http://transcoder.local/health');
    expect(calls[0]).not.toContain('unix:');
  });

  it('reports an unreachable service rather than throwing', async () => {
    const client = createTranscoderClient({
      baseUrl: 'unix:/run/valence-transcoder.sock',
      fetchImpl: () => Promise.reject(new Error('ENOENT')),
    });

    await expect(client.isReachable()).resolves.toBe(false);
  });

  it('carries every audio stream detail through, rather than dropping what it forgot to declare', async () => {
    const client = createTranscoderClient({
      baseUrl: 'http://127.0.0.1:8477',
      fetchImpl: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: () =>
            Promise.resolve({
              container: 'mkv',
              durationSeconds: 1200,
              bitrateKbps: 4000,
              video: null,
              subtitleStreams: [],
              chapters: [],
              audioStreams: [
                {
                  index: 3,
                  codec: 'aac',
                  channels: 2,
                  language: null,
                  title: "Director's Commentary",
                  isDefault: true,
                  isAtmos: false,
                },
              ],
            }),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        }),
    });

    const probe = await client.probe('/media/film.mkv');

    expect(probe.audioStreams[0]).toMatchObject({
      title: "Director's Commentary",
      isDefault: true,
    });
  });

  it('reads a probe from an older service that says nothing about titles', async () => {
    const client = createTranscoderClient({
      baseUrl: 'http://127.0.0.1:8477',
      fetchImpl: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: () =>
            Promise.resolve({
              container: 'mkv',
              durationSeconds: 1200,
              bitrateKbps: 4000,
              video: null,
              subtitleStreams: [],
              chapters: [],
              audioStreams: [
                { index: 1, codec: 'aac', channels: 2, language: 'eng', isAtmos: false },
              ],
            }),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        }),
    });

    const probe = await client.probe('/media/film.mkv');

    expect(probe.audioStreams[0]).toMatchObject({ title: null, isDefault: false });
  });
});

/**
 * A media service that answers whatever the test says it does, and records what it was asked.
 */
const scripted = (
  answer: Partial<{
    ok: boolean;
    status: number;
    body: JsonValue;
    bytes: ArrayBuffer;
    headers: Record<string, string>;
  }> = {},
) => {
  const asked: { url: string; init?: { method?: string; body?: string } }[] = [];

  const client = createTranscoderClient({
    baseUrl: 'http://127.0.0.1:8477',
    fetchImpl: (url, init) => {
      asked.push({ url, ...(init === undefined ? {} : { init }) });

      return Promise.resolve({
        ok: answer.ok ?? true,
        status: answer.status ?? 200,
        headers: { get: (name: string) => answer.headers?.[name] ?? null },
        json: () => Promise.resolve(answer.body ?? {}),
        arrayBuffer: () => Promise.resolve(answer.bytes ?? new ArrayBuffer(8)),
      });
    },
    streamFetchImpl: (url, init) => {
      asked.push({ url, ...(init === undefined ? {} : { init }) });

      return Promise.resolve({
        ok: answer.ok ?? true,
        status: answer.status ?? 200,
        headers: { get: (name: string) => answer.headers?.[name] ?? null },
        body: (answer.ok ?? true) ? new Blob([new Uint8Array(8)]).stream() : null,
      });
    },
  });

  return { client, asked };
};

describe('every question the client asks the media service', () => {
  it('starts a session by sending the whole specification', async () => {
    const { client, asked } = scripted({ body: { id: 'session-1', manifest: 'index.m3u8' } });

    const started = await client.startSession({
      inputPath: '/media/a.mkv',
      startSeconds: 0,
      segmentSeconds: 4,
      hardwareAccel: '',
      video: { kind: 'copy' },
      audio: { kind: 'copy' },
    });

    expect(started.id).toBe('session-1');
    expect(asked[0]?.url).toBe('http://127.0.0.1:8477/sessions');
    expect(asked[0]?.init?.method).toBe('POST');
  });

  it('ends a session, and says whether the service agreed', async () => {
    const { client, asked } = scripted();

    await expect(client.stopSession('session-1')).resolves.toBe(true);
    expect(asked[0]?.init?.method).toBe('DELETE');
  });

  it('reports a session the service would not end', async () => {
    const { client } = scripted({ ok: false, status: 404 });

    await expect(client.stopSession('session-1')).resolves.toBe(false);
  });

  it('says a session is still being watched', async () => {
    const { client, asked } = scripted();

    await expect(client.heartbeatSession('session-1', true)).resolves.toBe(true);
    expect(asked[0]?.url).toContain('/sessions/session-1/heartbeat');
  });

  it('reads a file belonging to a session', async () => {
    const { client } = scripted({ headers: { 'content-type': 'video/mp2t' } });

    const file = await client.readSessionFile('session-1', 'segment-0.ts');

    expect(file).toMatchObject({ contentType: 'video/mp2t' });
  });

  it('hands a segment back as it arrives rather than holding the whole of it', async () => {
    const { client } = scripted({ headers: { 'content-type': 'video/mp2t' } });

    const file = await client.readSessionFile('session-1', 'segment-0.ts');

    expect(file?.body).toBeInstanceOf(ReadableStream);
  });

  it('has nothing for a session file the service does not have', async () => {
    const { client } = scripted({ ok: false, status: 404 });

    await expect(client.readSessionFile('session-1', 'missing.ts')).resolves.toBeNull();
  });

  it('asks for a fingerprint of a stretch of a file', async () => {
    const { client, asked } = scripted({
      body: { hashes: [1, 2, 3], framesPerSecond: 10, startSeconds: 0 },
    });

    const found = await client.fingerprint({
      inputPath: '/media/a.mkv',
      startSeconds: 0,
      durationSeconds: 90,
    });

    expect(found.hashes).toEqual([1, 2, 3]);
    expect(asked[0]?.url).toContain('/fingerprint');
  });

  it('reads a single frame as bytes rather than as words', async () => {
    const { client, asked } = scripted({ bytes: new ArrayBuffer(16) });

    const frame = await client.readFrame({
      inputPath: '/media/a.mkv',
      atSeconds: 12,
      width: 320,
    });

    expect(frame.byteLength).toBe(16);
    expect(asked[0]?.url).toContain('/frame');
  });

  it('asks for a preview clip', async () => {
    const { client, asked } = scripted({
      body: { id: 'clip-1', url: '/previews/clip-1/clip.mp4', isReady: true },
    });

    await client.requestPreview({
      inputPath: '/media/a.mkv',
      generation: 0,
      quality: 'high',
      wait: true,
    });

    expect(asked[0]?.url).toContain('/previews');
  });

  it('asks for a sheet of thumbnails', async () => {
    const { client, asked } = scripted({
      body: {
        id: 'sheet-1',
        intervalSeconds: 10,
        tileWidth: 160,
        tileHeight: 90,
        columns: 5,
        rows: 5,
        sheets: ['sheet-000.jpg'],
        index: 'index.vtt',
        isReady: true,
      },
    });

    await client.requestTrickplay({
      inputPath: '/media/a.mkv',
      generation: 0,
      intervalSeconds: 10,
      tileWidth: 160,
      columns: 5,
      rows: 5,
    });

    expect(asked[0]?.url).toContain('/trickplay');
  });

  it('reads a thumbnail sheet', async () => {
    const { client } = scripted({ headers: { 'content-type': 'image/jpeg' } });

    await expect(client.readTrickplayFile('sheet-1', 'sheet-000.jpg')).resolves.toMatchObject({
      contentType: 'image/jpeg',
    });
  });

  it('falls back to bytes for a sheet the service does not describe', async () => {
    const { client } = scripted();

    await expect(client.readTrickplayFile('sheet-1', 'sheet-000.jpg')).resolves.toMatchObject({
      contentType: 'application/octet-stream',
    });
  });

  it('has nothing for a sheet that is not there', async () => {
    const { client } = scripted({ ok: false, status: 404 });

    await expect(client.readTrickplayFile('sheet-1', 'sheet-000.jpg')).resolves.toBeNull();
  });

  it('reads a subtitle track as the text inside it', async () => {
    const { client, asked } = scripted({ body: { content: 'WEBVTT\n\n' } });

    await expect(client.readSubtitle({ inputPath: '/a.mkv', streamIndex: 2 })).resolves.toContain(
      'WEBVTT',
    );
    expect(asked[0]?.url).toContain('/subtitles');
  });

  it('reads what the service says about how it is doing', async () => {
    const { client, asked } = scripted({ body: { sessions: 2 } });

    await expect(client.readMonitor()).resolves.toEqual({ sessions: 2 });
    expect(asked[0]?.url).toContain('/monitor');
  });

  it('raises what the service refused, with the status it refused it with', async () => {
    const { client } = scripted({ ok: false, status: 503 });

    await expect(client.readMonitor()).rejects.toThrow(/rejected/);
  });
});

describe('reclaiming what nothing addresses any more', () => {
  const USE = { count: 3, bytes: 1024 };

  it('sweeps preview clips, keeping what is still wanted', async () => {
    const { client, asked } = scripted({
      body: { removed: 2, freedBytes: 4096, kept: 5, tooNew: 1 },
    });

    await expect(
      client.sweepPreviews([{ inputPath: '/media/a.mkv', generation: 0, quality: 'high' }]),
    ).resolves.toMatchObject({ removed: 2, freedBytes: 4096, kept: 5, tooNew: 1 });

    expect(asked[0]?.url).toContain('/previews/sweep');
    expect(asked[0]?.init?.body).toContain('/media/a.mkv');
  });

  it('sweeps thumbnail sheets the same way', async () => {
    const { client, asked } = scripted({
      body: { removed: 0, freedBytes: 0, kept: 9, tooNew: 0 },
    });

    await expect(client.sweepTrickplay([])).resolves.toMatchObject({ kept: 9 });
    expect(asked[0]?.url).toContain('/trickplay/sweep');
  });

  it('forgets one item’s preview, and says whether there was one', async () => {
    const { client, asked } = scripted({ body: { forgotten: true } });

    await expect(
      client.forgetPreview({ inputPath: '/media/a.mkv', generation: 0, quality: 'high' }),
    ).resolves.toBe(true);

    expect(asked[0]?.url).toContain('/previews/forget');
  });

  it('forgets one item’s thumbnails', async () => {
    const { client } = scripted({ body: { forgotten: false } });

    await expect(
      client.forgetTrickplay({
        inputPath: '/media/a.mkv',
        generation: 0,
        intervalSeconds: 10,
        tileWidth: 160,
        columns: 5,
        rows: 5,
      }),
    ).resolves.toBe(false);
  });

  it('measures what the cache is holding', async () => {
    const { client } = scripted({
      body: { previews: USE, trickplay: USE, sessions: USE, atMs: 1 },
    });

    await expect(client.measureCache()).resolves.toMatchObject({ previews: { count: 3 } });
  });

  it('has no measurement when the service would not give one', async () => {
    const { client } = scripted({ ok: false, status: 503 });

    await expect(client.measureCache()).resolves.toBeNull();
  });

  it('has no measurement when the answer is not one it recognises', async () => {
    const { client } = scripted({ body: { nope: true } });

    await expect(client.measureCache()).resolves.toBeNull();
  });
});

describe('reading a file the media service is still writing', () => {
  const streaming = (options: {
    ok?: boolean;
    status?: number;
    contentType?: string | null;
    body?: ReadableStream | null;
  }) => {
    const asked: { url: string; init?: { headers?: Record<string, string> } }[] = [];

    const streamFetch = vi.fn((url: string, init?: { headers?: Record<string, string> }) => {
      asked.push({ url, ...(init === undefined ? {} : { init }) });

      return Promise.resolve({
        ok: options.ok ?? true,
        status: options.status ?? 200,
        headers: {
          get: (name: string) => (name === 'content-type' ? (options.contentType ?? null) : null),
        },
        body: options.body === undefined ? new ReadableStream() : options.body,
      });
    });

    vi.stubGlobal('fetch', streamFetch);

    return { asked };
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const client = () => createTranscoderClient({ baseUrl: 'http://127.0.0.1:8477' });

  it('asks for only the stretch a player wanted', async () => {
    const { asked } = streaming({ contentType: 'video/mp4' });

    await client().readFile('/media/Arrival.mkv', 'bytes=0-1023');

    expect(asked[0]?.init?.headers).toMatchObject({ range: 'bytes=0-1023' });
  });

  it('asks for the whole file where no stretch was named', async () => {
    const { asked } = streaming({ contentType: 'video/mp4' });

    await client().readFile('/media/Arrival.mkv', null);

    expect(asked[0]?.init?.headers).toBeUndefined();
  });

  it('carries what the media service said the file is', async () => {
    streaming({ contentType: 'video/mp4' });

    await expect(client().readFile('/media/Arrival.mkv', null)).resolves.toMatchObject({
      contentType: 'video/mp4',
    });
  });

  it('falls back to a sensible type where the media service named none', async () => {
    streaming({ contentType: null });

    await expect(client().readFile('/media/Arrival.mkv', null)).resolves.toMatchObject({
      contentType: 'application/octet-stream',
    });
  });

  it('answers with nothing where the media service refused', async () => {
    streaming({ ok: false, status: 404 });

    await expect(client().readFile('/media/Arrival.mkv', null)).resolves.toBeNull();
  });

  it('answers with nothing where there is no body to read', async () => {
    streaming({ body: null });

    await expect(client().readFile('/media/Arrival.mkv', null)).resolves.toBeNull();
  });

  it('hands back the monitor stream while it is open', async () => {
    streaming({});

    await expect(client().openMonitorStream()).resolves.not.toBeNull();
  });

  it('answers with nothing where the monitor stream cannot be opened', async () => {
    streaming({ ok: false, status: 503 });

    await expect(client().openMonitorStream()).resolves.toBeNull();
  });
});
