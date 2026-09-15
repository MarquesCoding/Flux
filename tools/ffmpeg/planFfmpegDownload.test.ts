import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { planFfmpegDownload, SUITE } from './planFfmpegDownload';

const ROOT = join(import.meta.dirname, '..', '..');

const VERSION = '8.1.2-5.1';

describe('planFfmpegDownload', () => {
  it('takes the portable tarball on Apple silicon', () => {
    const plan = planFfmpegDownload({ platform: 'darwin', arch: 'arm64', version: VERSION });

    expect(plan).toStrictEqual({
      kind: 'tarball',
      fileName: `valence-ffmpeg_${VERSION}_portable_macarm64-gpl.tar.xz`,
      url: `https://github.com/ValenceOSS/valence-ffmpeg/releases/download/v${VERSION}/valence-ffmpeg_${VERSION}_portable_macarm64-gpl.tar.xz`,
    });
  });

  it('takes the deb on Linux, named the way Debian names architectures', () => {
    const plan = planFfmpegDownload({ platform: 'linux', arch: 'x64', version: VERSION });

    expect(plan).toStrictEqual({
      kind: 'deb',
      fileName: `valence-ffmpeg_${VERSION}-${SUITE}_amd64.deb`,
      url: `https://github.com/ValenceOSS/valence-ffmpeg/releases/download/v${VERSION}/valence-ffmpeg_${VERSION}-${SUITE}_amd64.deb`,
    });
  });

  it('leaves arm64 alone, which Debian and Node already agree on', () => {
    const plan = planFfmpegDownload({ platform: 'linux', arch: 'arm64', version: VERSION });

    expect(plan).toMatchObject({ fileName: `valence-ffmpeg_${VERSION}-${SUITE}_arm64.deb` });
  });

  it('says why an Intel Mac has nothing to fetch', () => {
    const plan = planFfmpegDownload({ platform: 'darwin', arch: 'x64', version: VERSION });

    expect(plan).toMatchObject({ kind: 'unsupported' });
  });

  it('says why Windows has nothing to fetch', () => {
    const plan = planFfmpegDownload({ platform: 'win32', arch: 'x64', version: VERSION });

    expect(plan).toMatchObject({ kind: 'unsupported' });
  });

  it('asks for the same deb the image installs', () => {
    const dockerfile = readFileSync(join(ROOT, 'Dockerfile'), 'utf8');
    const plan = planFfmpegDownload({ platform: 'linux', arch: 'arm64', version: VERSION });

    expect(plan.kind).toBe('deb');
    expect(dockerfile).toContain(`-${SUITE}_\${TARGETARCH}.deb`);
  });
});
