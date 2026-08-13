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
   * Whether the machine could not verify what has been forced.
   *
   * Not the same as the probe merely disagreeing about an encoder. This is
   * asking for a backend the host has no way to provide at all — NVENC on
   * Apple silicon — where the honest thing is to say so rather than to report
   * a setting that will fall back to software on every play.
   */
  isUnverified: boolean;
  /**
   * What to say about a choice the machine cannot keep, where there is one.
   */
  warning?: string;
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
    return { label: 'Software only · forced', isUnverified: false };
  }

  if (forced !== '') {
    const chosen = accelerationOptions.find((option) => option.id === forced);

    const isUnverified = !probed.includes(forced);

    return {
      label: `${chosen?.label ?? forced} · forced`,
      isUnverified,
      ...(isUnverified
        ? {
            warning: `This machine never proved it can do ${chosen?.label ?? forced}, so every transcode will fall back to software. Choose Automatic to use what it can, or leave this if you know the check is wrong.`,
          }
        : {}),
    };
  }

  if (probed.length === 0) {
    return { label: 'Software only', isUnverified: false };
  }

  return { label: `${probed.join(', ')} · automatic`, isUnverified: false };
};

export { describeAcceleration };
export type { Acceleration };
