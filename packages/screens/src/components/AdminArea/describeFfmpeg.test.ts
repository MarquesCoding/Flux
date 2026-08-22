import { describe, expect, it } from 'vitest';
import { describeFfmpeg } from './describeFfmpeg';

const FLUX = 'ffmpeg version 8.1.2-Flux Copyright (c) 2000-2026 the FFmpeg developers';

const HOMEBREW = 'ffmpeg version 8.1.2 Copyright (c) 2000-2026 the FFmpeg developers';

describe('describeFfmpeg', () => {
  it('names Valence own build, without repeating the stamp the name already carries', () => {
    expect(describeFfmpeg(FLUX)).toBe('flux-ffmpeg 8.1.2');
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
    expect(describeFfmpeg(`${FLUX}\nconfiguration: --prefix=/ffbuild --enable-gpl`)).toBe(
      'flux-ffmpeg 8.1.2',
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
