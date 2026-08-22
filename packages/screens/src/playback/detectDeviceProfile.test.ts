import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeviceProfileSchema } from '@ValenceContracts/schemas/DeviceProfile';
import { detectDeviceProfile, detectFromBrowser } from './detectDeviceProfile';

const supporting =
  (...supported: string[]) =>
  (mimeType: string) =>
    supported.some((fragment) => mimeType.includes(fragment));

const supportingCodecs =
  (...supported: string[]) =>
  (mimeType: string) =>
    supported.includes(/codecs="([^"]+)"/.exec(mimeType)?.[1] ?? mimeType);

const build = (
  isTypeSupported: (mimeType: string) => boolean,
  overrides: Partial<Parameters<typeof detectDeviceProfile>[0]> = {},
) =>
  detectDeviceProfile({
    isTypeSupported,
    platform: 'MacIntel',
    supportsHdr: false,
    screenWidth: 1920,
    screenHeight: 1080,
    name: 'Browser',
    ...overrides,
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('detectDeviceProfile', () => {
  it('produces a profile the server contract accepts', () => {
    const profile = build(supporting('avc1', 'mp4a'));

    expect(DeviceProfileSchema.safeParse(profile).success).toBe(true);
  });

  it('reports the codecs the browser actually supports', () => {
    const profile = build(supporting('avc1', 'hvc1', 'mp4a', 'ec-3'));

    expect(profile.directPlayProfiles[0]?.videoCodecs).toEqual(['h264', 'hevc']);
    expect(profile.directPlayProfiles[0]?.audioCodecs).toEqual(['aac', 'eac3']);
  });

  it('does not claim a codec the browser rejects', () => {
    const profile = build(supporting('avc1', 'mp4a'));

    expect(profile.directPlayProfiles[0]?.videoCodecs).not.toContain('hevc');
    expect(profile.directPlayProfiles[0]?.audioCodecs).not.toContain('eac3');
  });

  it('asks about ten bit video separately from eight', () => {
    const profile = build((mimeType) => mimeType.includes('hvc1.1') || mimeType.includes('mp4a'));

    expect(profile.directPlayProfiles[0]?.videoCodecs).toContain('hevc');
    expect(profile.tenBitVideoCodecs).not.toContain('hevc');
  });

  it('claims ten bit only where the browser accepts it', () => {
    const profile = build((mimeType) => mimeType.includes('hvc1') || mimeType.includes('mp4a'));

    expect(profile.tenBitVideoCodecs).toContain('hevc');
  });

  it('asks about the level ordinary high definition carries', () => {
    const seen: string[] = [];

    build((mimeType) => {
      seen.push(mimeType);

      return false;
    });

    expect(seen).toContain('video/mp4; codecs="hvc1.1.6.L120.B0"');
    expect(seen).toContain('video/mp4; codecs="hvc1.2.4.L120.B0"');
  });

  it('probes concrete codec strings rather than container families', () => {
    const seen: string[] = [];

    build((mimeType) => {
      seen.push(mimeType);

      return false;
    });

    expect(seen.every((mimeType) => mimeType.includes('codecs='))).toBe(true);
  });

  it('falls back to h264 and aac when the browser answers nothing', () => {
    const profile = build(() => false);

    expect(profile.directPlayProfiles[0]?.videoCodecs).toEqual(['h264']);
    expect(profile.directPlayProfiles[0]?.audioCodecs).toEqual(['aac']);
  });

  it('claims only SDR by default', () => {
    expect(build(supporting('avc1')).supportedVideoRanges).toEqual(['SDR']);
  });

  it('claims HDR when the display reports a high dynamic range', () => {
    const profile = build(supporting('avc1', 'hvc1'), { supportsHdr: true });

    expect(profile.supportedVideoRanges).toContain('HDR10');
    expect(profile.supportedVideoRanges).toContain('HLG');
  });

  it('uses the real screen size as the resolution ceiling', () => {
    const profile = build(supporting('avc1'), { screenWidth: 3840, screenHeight: 2160 });

    expect(profile.maxWidth).toBe(3840);
    expect(profile.maxHeight).toBe(2160);
  });

  it('never reports a ceiling below a sensible floor', () => {
    const profile = build(supporting('avc1'), { screenWidth: 100, screenHeight: 80 });

    expect(profile.maxWidth).toBe(640);
    expect(profile.maxHeight).toBe(480);
  });

  it('always offers a transcoding target the server can produce', () => {
    const profile = build(() => false);

    expect(profile.transcodingProfiles[0]).toMatchObject({
      container: 'mp4',
      videoCodec: 'h264',
      protocol: 'hls',
    });
  });

  it('claims webvtt subtitles only', () => {
    expect(build(supporting('avc1')).supportedSubtitleFormats).toEqual(['webvtt']);
  });

  it('carries the client name through', () => {
    expect(build(supporting('avc1'), { name: 'Living room' }).name).toBe('Living room');
  });

  it('reports no HDR rather than failing in a browser without media queries', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(() => detectFromBrowser()).not.toThrow();
    expect(detectFromBrowser().supportedVideoRanges).toEqual(['SDR']);
  });

  describe('the limits a browser can actually be asked about', () => {
    it('reports the highest H.264 level the browser accepts', () => {
      const profile = build(supporting('avc1.640028', 'avc1.64001f', 'avc1.64001e', 'mp4a'));

      expect(profile.maxVideoLevels.h264).toBe(40);
    });

    it('reports the highest HEVC level separately from H.264', () => {
      const profile = build(supporting('avc1.640033', 'hvc1.1.6.L120', 'mp4a'));

      expect(profile.maxVideoLevels).toMatchObject({ h264: 51, hevc: 120 });
    });

    it('claims no level ceiling where the browser accepts none of the probes', () => {
      expect(build(supporting('vp09', 'opus')).maxVideoLevels).toEqual({});
    });

    it('refuses HE-AAC when the browser takes AAC-LC and nothing more', () => {
      const profile = build(supportingCodecs('avc1.640028', 'mp4a.40.2'));

      expect(profile.unsupportedAudioProfiles).toEqual(['HE-AAC']);
    });

    it('says nothing about HE-AAC when the browser decodes it', () => {
      const profile = build(supportingCodecs('avc1.640028', 'mp4a.40.2', 'mp4a.40.5'));

      expect(profile.unsupportedAudioProfiles).toEqual([]);
    });

    it('says nothing about HE-AAC when the browser has no AAC at all', () => {
      const profile = build(supportingCodecs('avc1.640028', 'ec-3'));

      expect(profile.unsupportedAudioProfiles).toEqual([]);
    });

    it('declares interlaced video unplayable, because Media Source has no deinterlacer', () => {
      expect(build(supporting('avc1', 'mp4a')).canPlayInterlaced).toBe(false);
    });

    it('leaves unaskable limits unstated rather than guessing a ceiling', () => {
      const profile = build(supporting('avc1', 'mp4a'));

      expect(profile.maxFrameRate ?? null).toBeNull();
      expect(profile.maxRefFrames ?? null).toBeNull();
      expect(profile.maxAudioSampleRate ?? null).toBeNull();
    });
  });
});

describe('the ceilings a browser cannot be asked about', () => {
  it('states no bitrate, rather than inventing one the browser never reported', () => {
    expect(build(() => true).maxBitrateKbps).toBeUndefined();
  });

  it('states one where a caller genuinely knows of a limit', () => {
    expect(build(() => true, { maxBitrateKbps: 6000 }).maxBitrateKbps).toBe(6000);
  });
});

describe('claiming a codec only in the container Valence actually sends', () => {
  const takingOnly =
    (...types: string[]) =>
    (mimeType: string) =>
      types.includes(mimeType);

  it('claims opus where the browser takes it in mp4', () => {
    const profile = build(takingOnly('audio/mp4; codecs="opus"'));

    expect(profile.directPlayProfiles[0]?.audioCodecs).toContain('opus');
  });

  it('does not claim opus where the browser takes it only in webm', () => {
    const profile = build(takingOnly('audio/webm; codecs="opus"'));

    expect(profile.directPlayProfiles[0]?.audioCodecs).not.toContain('opus');
  });

  it('does not claim vp9 where the browser takes it only in webm', () => {
    const profile = build(takingOnly('video/webm; codecs="vp9"'));

    expect(profile.directPlayProfiles[0]?.videoCodecs).not.toContain('vp9');
  });

  it('claims nothing at all from a browser that only plays webm', () => {
    const webmOnly = (mimeType: string) =>
      mimeType.startsWith('video/webm') || mimeType.startsWith('audio/webm');
    const profile = build(webmOnly);

    expect(profile.directPlayProfiles[0]?.videoCodecs).toEqual(['h264']);
    expect(profile.directPlayProfiles[0]?.audioCodecs).toEqual(['aac']);
  });

  it('does not claim ten bit vp9 on the strength of a webm answer', () => {
    const profile = build(takingOnly('video/webm; codecs="vp09.02.10.10"'));

    expect(profile.tenBitVideoCodecs).not.toContain('vp9');
  });
});

describe('how many channels the profile claims', () => {
  it('claims what the output device accepts rather than assuming stereo', () => {
    expect(build(supporting('avc1', 'mp4a'), { maxAudioChannels: 6 }).maxAudioChannels).toBe(6);
  });

  it('claims stereo where nothing said otherwise', () => {
    expect(build(supporting('avc1', 'mp4a')).maxAudioChannels).toBe(2);
  });

  it('never claims fewer than two, so a device answering nonsense is no worse off', () => {
    expect(build(supporting('avc1', 'mp4a'), { maxAudioChannels: 0 }).maxAudioChannels).toBe(2);
    expect(build(supporting('avc1', 'mp4a'), { maxAudioChannels: 1 }).maxAudioChannels).toBe(2);
  });

  it('claims stereo where the number it was handed is not a number at all', () => {
    expect(
      build(supporting('avc1', 'mp4a'), { maxAudioChannels: Number.NaN }).maxAudioChannels,
    ).toBe(2);
  });

  it('claims a whole number of channels, since half a channel is not a thing', () => {
    expect(build(supporting('avc1', 'mp4a'), { maxAudioChannels: 7.5 }).maxAudioChannels).toBe(7);
  });
});

describe('asking the browser how many channels the output takes', () => {
  const anOutputAccepting = (maxChannelCount: number) => {
    const close = vi.fn(() => Promise.resolve());

    vi.stubGlobal(
      'AudioContext',
      class {
        destination = { maxChannelCount };
        close = close;
      },
    );

    return { close };
  };

  it('reports what the device says it takes', () => {
    anOutputAccepting(8);

    expect(detectFromBrowser().maxAudioChannels).toBe(8);
  });

  it('lets go of the context it opened to ask', () => {
    const { close } = anOutputAccepting(6);

    detectFromBrowser();

    expect(close).toHaveBeenCalledOnce();
  });

  it('falls back to stereo on a browser with no audio context at all', () => {
    vi.stubGlobal('AudioContext', undefined);

    expect(detectFromBrowser().maxAudioChannels).toBe(2);
  });

  it('falls back to stereo rather than throwing where opening one fails', () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('no audio device');
        }
      },
    );

    expect(() => detectFromBrowser()).not.toThrow();
    expect(detectFromBrowser().maxAudioChannels).toBe(2);
  });

  it('falls back to stereo where the device answers with nothing usable', () => {
    anOutputAccepting(Number.NaN);

    expect(detectFromBrowser().maxAudioChannels).toBe(2);
  });
});

describe('a build that claims Dolby it cannot decode', () => {
  const dolby = supportingCodecs('mp4a.40.2', 'ac-3', 'ec-3', 'avc1.640028');

  it('believes a Mac, where the platform decoders it uses exist', () => {
    expect(build(dolby, { platform: 'MacIntel' }).directPlayProfiles[0]?.audioCodecs).toContain(
      'eac3',
    );
  });

  it('believes Windows, for the same reason', () => {
    expect(build(dolby, { platform: 'Win32' }).directPlayProfiles[0]?.audioCodecs).toContain(
      'eac3',
    );
  });

  it('refuses to believe Linux, which answers yes and then plays silence', () => {
    const audio = build(dolby, { platform: 'Linux x86_64' }).directPlayProfiles[0]?.audioCodecs;

    expect(audio).not.toContain('eac3');
    expect(audio).not.toContain('ac3');
  });

  it('refuses ChromeOS too, which is the same engine on the same platform decoders', () => {
    expect(
      build(dolby, { platform: 'CrOS x86_64' }).directPlayProfiles[0]?.audioCodecs,
    ).not.toContain('eac3');
  });

  it('keeps everything else it said it could play, since only Dolby is in question', () => {
    const profile = build(dolby, { platform: 'Linux x86_64' });

    expect(profile.directPlayProfiles[0]?.audioCodecs).toContain('aac');
    expect(profile.directPlayProfiles[0]?.videoCodecs).toContain('h264');
  });
});
