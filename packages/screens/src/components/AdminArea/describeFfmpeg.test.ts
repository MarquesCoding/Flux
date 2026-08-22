import { describe, expect, it } from 'vitest';
import { describeFfmpeg } from './describeFfmpeg';

const OURS = 'ffmpeg version 8.1.2-Valence Copyright (c) 2000-2026 the FFmpeg developers';

const HOMEBREW = 'ffmpeg version 8.1.2 Copyright (c) 2000-2026 the FFmpeg developers';

describe('describeFfmpeg', () => {
  it('names Valence own build, without repeating the stamp the name already carries', () => {
    expect(describeFfmpeg(OURS)).toBe('valence-ffmpeg 8.1.2');
  });

  it('does not claim a stock build is Valence own', () => {
    expect(describeFfmpeg(HOMEBREW)).toBe('ffmpeg 8.1.2');
  });

  it('keeps a suffix that belongs to somebody else', () => {
    expect(describeFfmpeg('ffmpeg version 8.1.2-Jellyfin Copyright (c) 2000-2026')).toBe(
      'ffmpeg 8.1.2-Jellyfin',
    );
  });

  it('drops the paragraph of build configuration that follows the version', () => {
    expect(describeFfmpeg(`${OURS}\nconfiguration: --prefix=/ffbuild --enable-gpl`)).toBe(
      'valence-ffmpeg 8.1.2',
    );
  });

  it('says so when the transcoder never answered', () => {
    expect(describeFfmpeg(null)).toBe('ffmpeg unknown');
  });

  it('shows what it was given when it cannot find a version in it', () => {
    expect(describeFfmpeg('something else entirely')).toBe('ffmpeg something else entirely');
  });

  it('does not let an unparseable answer run away with the tile', () => {
    expect(describeFfmpeg('x'.repeat(200))).toBe(`ffmpeg ${'x'.repeat(24)}`);
  });
});

describe('a build stamped before the rename', () => {
  it('is still ours, since every binary already fetched says the old name', () => {
    expect(describeFfmpeg('ffmpeg version 8.1.2-Valence Copyright (c) 2000-2026')).toContain(
      'valence-ffmpeg',
    );
  });

  it('is ours under the new name too', () => {
    expect(describeFfmpeg('ffmpeg version 8.1.2-Valence Copyright (c) 2000-2026')).toContain(
      'valence-ffmpeg',
    );
  });

  it('is still not ours where nothing was stamped', () => {
    expect(describeFfmpeg('ffmpeg version 7.1 Copyright (c) 2000-2026')).not.toContain(
      'valence-ffmpeg',
    );
  });
});
