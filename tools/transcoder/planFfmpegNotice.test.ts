import { describe, expect, it } from 'vitest';
import { planFfmpegNotice } from './planFfmpegNotice';

const FFMPEG = '/repo/.ffmpeg/ffmpeg';

const FFPROBE = '/repo/.ffmpeg/ffprobe';

const present = (): boolean => true;

const absent = (): boolean => false;

describe('planFfmpegNotice', () => {
  it('stays quiet when both point at something that is there', () => {
    expect(planFfmpegNotice({ ffmpeg: FFMPEG, ffprobe: FFPROBE, exists: present })).toBeUndefined();
  });

  it('says the service will fall back to PATH when neither is set', () => {
    const notice = planFfmpegNotice({ ffmpeg: undefined, ffprobe: undefined, exists: present });

    expect(notice).toContain('on PATH');
    expect(notice).toContain('pnpm ffmpeg:sync');
  });

  it('names the variable whose path is not there', () => {
    const notice = planFfmpegNotice({ ffmpeg: FFMPEG, ffprobe: FFPROBE, exists: absent });

    expect(notice).toContain('VALENCE_FFMPEG points at /repo/.ffmpeg/ffmpeg');
    expect(notice).toContain('VALENCE_FFPROBE points at /repo/.ffmpeg/ffprobe');
  });

  it('catches a deleted build behind a stale setting', () => {
    const notice = planFfmpegNotice({
      ffmpeg: FFMPEG,
      ffprobe: FFPROBE,
      exists: (path) => path !== FFMPEG,
    });

    expect(notice).toContain('VALENCE_FFMPEG points at');
    expect(notice).not.toContain('VALENCE_FFPROBE points at');
  });

  it('warns when only one of the pair is set, since they are read separately', () => {
    const notice = planFfmpegNotice({ ffmpeg: FFMPEG, ffprobe: undefined, exists: present });

    expect(notice).toContain('VALENCE_FFPROBE is not set');
  });

  it('treats an empty value as unset rather than as a path', () => {
    const notice = planFfmpegNotice({ ffmpeg: '', ffprobe: '', exists: absent });

    expect(notice).toContain('on PATH');
  });
});
