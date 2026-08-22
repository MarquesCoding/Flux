import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pinnedFfmpegVersion } from './pinnedFfmpegVersion';

const ROOT = join(import.meta.dirname, '..', '..');

const CI_VERSION = /^\s*VALENCE_FFMPEG_VERSION:\s*(?<version>\S+)\s*$/mu;

describe('pinnedFfmpegVersion', () => {
  it('reads the version the image is pinned to', () => {
    expect(pinnedFfmpegVersion('ARG VALENCE_FFMPEG_VERSION=8.1.2-2flux1\n')).toBe('8.1.2-2flux1');
  });

  it('ignores a mention that is not the declaration', () => {
    const dockerfile = [
      '# VALENCE_FFMPEG_VERSION=9.9.9 would be a comment, not a pin',
      'ARG VALENCE_FFMPEG_VERSION=8.1.2-2flux1',
    ].join('\n');

    expect(pinnedFfmpegVersion(dockerfile)).toBe('8.1.2-2flux1');
  });

  it('refuses to guess when the declaration is gone', () => {
    expect(() => pinnedFfmpegVersion('FROM debian:bookworm\n')).toThrow(
      /no ARG VALENCE_FFMPEG_VERSION/u,
    );
  });

  it('agrees with the version CI installs', () => {
    const dockerfile = readFileSync(join(ROOT, 'Dockerfile'), 'utf8');
    const workflow = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');

    expect(CI_VERSION.exec(workflow)?.groups?.['version']).toBe(pinnedFfmpegVersion(dockerfile));
  });
});
