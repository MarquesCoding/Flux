import { describe, expect, it } from 'vitest';
import {
  baseStreamArguments,
  muxArguments,
  SYNTHESISED,
  synthesisedUpTo,
  toolUrl,
} from './synthesisedFixtures';

const named = (name: string) => {
  const found = SYNTHESISED.find((fixture) => fixture.name === name);

  if (found === undefined) {
    throw new Error(`no fixture called ${name}`);
  }

  return found;
};

const valueAfter = (args: string[], flag: string): string => args[args.indexOf(flag) + 1] ?? '';

describe('SYNTHESISED', () => {
  it('covers both HDR systems FFmpeg cannot author', () => {
    expect(new Set(SYNTHESISED.map((fixture) => fixture.system))).toEqual(
      new Set(['DolbyVision', 'HDR10Plus']),
    );
  });

  it('records a licence saying the metadata was written rather than taken', () => {
    expect(SYNTHESISED.every((fixture) => fixture.licence.includes('written'))).toBe(true);
  });

  it('keeps them behind tier two, where the extra tools are opted into', () => {
    expect(synthesisedUpTo(0)).toEqual([]);
    expect(synthesisedUpTo(1)).toEqual([]);
    expect(synthesisedUpTo(2).length).toBe(SYNTHESISED.length);
  });
});

describe('baseStreamArguments', () => {
  it('writes an HDR10 base, because both systems are layered over one', () => {
    const args = baseStreamArguments(named('dolby-vision-profile-81'), '/out/base.hevc');
    const params = valueAfter(args, '-x265-params');

    expect(params).toContain('transfer=smpte2084');
    expect(params).toContain('colorprim=bt2020');
    expect(params).toContain('master-display=');
    expect(valueAfter(args, '-pix_fmt')).toBe('yuv420p10le');
  });

  it('writes a raw stream, which is what the injectors read', () => {
    const args = baseStreamArguments(named('hdr10plus-dynamic'), '/out/base.hevc');

    expect(valueAfter(args, '-f')).toBe('lavfi');
    expect(args.at(-2)).toBe('hevc');
    expect(args.at(-1)).toBe('/out/base.hevc');
  });

  it('runs exactly as long as the metadata it will carry', () => {
    const fixture = named('dolby-vision-profile-81');
    const args = baseStreamArguments(fixture, '/out/base.hevc');

    expect(Number(valueAfter(args, '-t'))).toBeCloseTo(fixture.frames / 25);
  });
});

describe('muxArguments', () => {
  it('gives mkvmerge a frame rate, which a raw stream does not carry', () => {
    const args = muxArguments('/in/carrying.hevc', '/out/fixture.mkv');

    expect(valueAfter(args, '-o')).toBe('/out/fixture.mkv');
    expect(valueAfter(args, '--default-duration')).toBe('0:25fps');
    expect(args.at(-1)).toBe('/in/carrying.hevc');
  });
});

describe('toolUrl', () => {
  it('takes the universal build on macOS', () => {
    const found = toolUrl('dovi', 'darwin', 'arm64');

    expect(found?.url).toContain('universal-macOS.zip');
    expect(found?.archive).toBe('zip');
  });

  it('picks the Linux build for the architecture it is on', () => {
    expect(toolUrl('hdr10plus', 'linux', 'x64')?.url).toContain('x86_64-unknown-linux-musl');
    expect(toolUrl('hdr10plus', 'linux', 'arm64')?.url).toContain('aarch64-unknown-linux-musl');
  });

  it('says nothing rather than guessing for a platform with no build', () => {
    expect(toolUrl('dovi', 'win32', 'x64')).toBeNull();
  });
});
