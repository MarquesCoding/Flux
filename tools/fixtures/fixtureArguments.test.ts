import { describe, expect, it } from 'vitest';
import { fixtureArguments, keyframeInterval, pixelFormat } from './fixtureArguments';
import { FIXTURES } from './fixtureMatrix';
import type { Fixture } from './fixtureMatrix';

const named = (name: string): Fixture => {
  const found = FIXTURES.find((fixture) => fixture.name === name);

  if (found === undefined) {
    throw new Error(`no fixture called ${name}`);
  }

  return found;
};

const argumentsFor = (name: string): string[] => fixtureArguments(named(name), '/out/file.mp4');

const valueAfter = (args: string[], flag: string): string => args[args.indexOf(flag) + 1] ?? '';

describe('pixelFormat', () => {
  it('asks for a ten bit format only where ten bits were wanted', () => {
    expect(pixelFormat({ ...named('hevc-10bit-closed').video })).toBe('yuv420p10le');
    expect(pixelFormat({ ...named('hevc-8bit-closed').video })).toBe('yuv420p');
  });
});

describe('keyframeInterval', () => {
  it('turns seconds into frames at the corpus frame rate', () => {
    expect(keyframeInterval({ ...named('h264-8bit-closed').video })).toBe(50);
    expect(keyframeInterval({ ...named('h264-keyframes-far').video })).toBe(250);
  });

  it('never asks for an interval of no frames', () => {
    expect(keyframeInterval({ ...named('h264-8bit-closed').video, keyframeSeconds: 0 })).toBe(1);
  });
});

describe('fixtureArguments', () => {
  it('states the GOP structure rather than trusting an encoder default', () => {
    expect(valueAfter(argumentsFor('h264-8bit-closed'), '-x264-params')).toContain('open-gop=0');
    expect(valueAfter(argumentsFor('h264-8bit-open'), '-x264-params')).toContain('open-gop=1');
    expect(valueAfter(argumentsFor('hevc-8bit-closed'), '-x265-params')).toContain('open-gop=0');
    expect(valueAfter(argumentsFor('hevc-8bit-open'), '-x265-params')).toContain('open-gop=1');
  });

  it('pins every encoder to one thread so the bytes are reproducible', () => {
    expect(valueAfter(argumentsFor('h264-8bit-closed'), '-x264-params')).toContain('threads=1');
    expect(valueAfter(argumentsFor('hevc-8bit-closed'), '-x265-params')).toContain('pools=1');
    expect(valueAfter(argumentsFor('av1-8bit-closed'), '-svtav1-params')).toContain('lp=1');
    expect(argumentsFor('vp9-8bit-closed')).toContain('-threads');
  });

  it('writes the range into the bitstream rather than only onto the container', () => {
    const hdr = valueAfter(argumentsFor('hevc-10bit-hdr10'), '-x265-params');

    expect(hdr).toContain('transfer=smpte2084');
    expect(argumentsFor('hevc-10bit-hdr10')).toContain('smpte2084');
  });

  it('asks for the top field first when the fixture is interlaced', () => {
    const args = argumentsFor('h264-interlaced');

    expect(args).toContain('-top');
    expect(valueAfter(args, '-vf')).toBe('interlace=scan=tff');
  });

  it('lets timestamps through unevenly for the variable frame rate fixture', () => {
    const args = argumentsFor('h264-variable-frame-rate');

    expect(valueAfter(args, '-fps_mode')).toBe('passthrough');
    expect(valueAfter(args, '-vf')).toContain('setpts');
  });

  it('gives TrueHD and DTS the side surround layout they insist on', () => {
    expect(valueAfter(argumentsFor('audio-truehd-51'), '-channel_layout')).toBe('5.1(side)');
    expect(valueAfter(argumentsFor('audio-dts-51'), '-channel_layout')).toBe('5.1(side)');
    expect(valueAfter(argumentsFor('audio-ac3-51'), '-channel_layout')).toBe('5.1');
  });

  it('writes to the path it was given', () => {
    expect(argumentsFor('h264-8bit-closed').at(-1)).toBe('/out/file.mp4');
  });
});
