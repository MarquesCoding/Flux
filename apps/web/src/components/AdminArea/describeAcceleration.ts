import { accelerationOptions } from '@FluxWeb/components/AdminArea/accelerationOptions';

type Acceleration = {
  /**
   * What to show, one badge each.
   */
  labels: string[];
  /**
   * Whether somebody chose this or the machine was asked.
   *
   * Absent when there is nothing useful to add — a server that found no
   * hardware at all is not usefully described as having found it automatically.
   */
  note?: 'forced' | 'automatic';
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
 * A forced choice is reported whether or not the probe agreed with it. The
 * setting exists precisely for the machine where the probe is wrong and the
 * card plainly works, so a backend the probe rejected must still read as
 * forced rather than as broken — that is somebody's deliberate decision, not a
 * fault to report.
 */
const describeAcceleration = (forced: string, probed: string[]): Acceleration => {
  if (forced !== '') {
    const chosen = accelerationOptions.find((option) => option.id === forced);

    return { labels: [chosen?.label ?? forced], note: 'forced' };
  }

  if (probed.length === 0) {
    return { labels: ['None'] };
  }

  return { labels: probed, note: 'automatic' };
};

export { describeAcceleration };
export type { Acceleration };
