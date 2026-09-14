import { describe, expect, it } from 'vitest';
import { envFileWithFfmpeg } from './envFileWithFfmpeg';

const PATHS = { ffmpeg: '/repo/.ffmpeg/ffmpeg', ffprobe: '/repo/.ffmpeg/ffprobe' };

describe('envFileWithFfmpeg', () => {
  it('adds both paths, because they are read independently', () => {
    const updated = envFileWithFfmpeg({ existing: 'PORT=8420\n', ...PATHS });

    expect(updated).toContain('VALENCE_FFMPEG=/repo/.ffmpeg/ffmpeg');
    expect(updated).toContain('VALENCE_FFPROBE=/repo/.ffmpeg/ffprobe');
  });

  it('keeps what the file already said', () => {
    const updated = envFileWithFfmpeg({ existing: 'PORT=8420\n', ...PATHS });

    expect(updated).toContain('PORT=8420');
  });

  it('leaves a file that already points somewhere deliberate', () => {
    const existing = 'VALENCE_FFMPEG=/opt/mine/ffmpeg\n';

    expect(envFileWithFfmpeg({ existing, ...PATHS })).toBeUndefined();
  });

  it('leaves a file that sets only the probe, which is the half that gets forgotten', () => {
    const existing = 'VALENCE_FFPROBE=/opt/mine/ffprobe\n';

    expect(envFileWithFfmpeg({ existing, ...PATHS })).toBeUndefined();
  });

  it('does not mistake a commented example for a setting', () => {
    const existing = '# VALENCE_FFMPEG=/usr/lib/valence-ffmpeg/ffmpeg\n';

    expect(envFileWithFfmpeg({ existing, ...PATHS })).toContain(
      'VALENCE_FFMPEG=/repo/.ffmpeg/ffmpeg',
    );
  });

  it('does not run the first line into the last one', () => {
    const updated = envFileWithFfmpeg({ existing: 'PORT=8420', ...PATHS });

    expect(updated).not.toContain('PORT=8420#');
    expect(updated).toContain('PORT=8420\n');
  });

  it('adds to an empty file without a leading blank line it did not need', () => {
    const updated = envFileWithFfmpeg({ existing: '', ...PATHS });

    expect(updated?.startsWith('\n#')).toBe(true);
  });
});
