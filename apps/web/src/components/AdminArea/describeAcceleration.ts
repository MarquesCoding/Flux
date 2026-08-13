import { accelerationOptions } from '@FluxWeb/components/AdminArea/accelerationOptions';

type Acceleration = {
  /**
   * What the badge says, in one piece.
   *
   * One badge rather than a badge and a loose word beside it: "automatic"
   * floating outside the pill reads as unrelated to it, and the two are one
   * fact — what will be used, and how that was decided.
   */
  label: string;
  /**
   * How much the choice is worth looking at.
   *
   * `danger` for one the machine cannot keep at all, `warning` for one it can
   * keep but which costs the processor every play, and quiet for a setting
   * doing what it should. A default that happens to be software is not a
   * warning: nobody chose it and there is nothing to reconsider.
   */
  tone: 'quiet' | 'warning' | 'danger';
  /**
   * What resting on the badge explains.
   *
   * Every state has one, not only the ones that are wrong. "videotoolbox ·
   * automatic" is perfectly correct and still means nothing to somebody who
   * has never chosen a video encoder.
   */
  detail: string;
};

/**
 * What the next transcode will actually use.
 *
 * Two different values were being confused. What the machine *can* do is the
 * list the media service probed at startup; what Flux *will* do is the setting
 * an operator chose, and the header was reporting the first while claiming to
 * report the second. Forcing software only left it still announcing a hardware
 * backend, which is the one moment somebody reads it.
 *
 * A forced choice is always reported as forced, because it is somebody's
 * deliberate decision. But a backend this host never proved it could do is
 * marked, because asking an Apple machine for NVENC is not a decision that can
 * be honoured — every play falls back to software, and a badge that read the
 * same as a working one would hide that completely.
 */
const describeAcceleration = (forced: string, probed: string[]): Acceleration => {
  if (forced === 'none') {
    return {
      label: 'Software only · forced',
      tone: 'warning',
      detail:
        'Hardware encoding is turned off, so every transcode is done by the processor — several times the work, and fewer streams at once. Choose Automatic to use the machine\u2019s own encoder where it can.',
    };
  }

  if (forced !== '') {
    const name = accelerationOptions.find((option) => option.id === forced)?.label ?? forced;
    const isUnverified = !probed.includes(forced);

    return {
      label: `${name} · forced`,
      tone: isUnverified ? 'danger' : 'quiet',
      detail: isUnverified
        ? `This machine never proved it can do ${name}, so every transcode will fall back to software. Choose Automatic to use what it can, or leave this if you know the check is wrong.`
        : `${name} was chosen rather than left to Flux, and the machine proved it can do it. Transcodes use it instead of the processor.`,
    };
  }

  if (probed.length === 0) {
    return {
      label: 'Software only',
      tone: 'quiet',
      detail:
        'This machine proved no hardware encoder Flux can use, so transcodes are done by the processor. Nothing was chosen — there was nothing to choose.',
    };
  }

  return {
    label: `${probed.join(', ')} · automatic`,
    tone: 'quiet',
    detail: `Flux uses whichever backend the machine proved it can do, which here is ${probed.join(' and ')}. Choose one in Settings to insist on it instead.`,
  };
};

export { describeAcceleration };
export type { Acceleration };
