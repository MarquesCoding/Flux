import { accelerationOptions } from '@ValenceScreens/components/AdminArea/accelerationOptions';

type Acceleration = {
  label: string;
  tone: 'quiet' | 'warning' | 'danger';
  detail: string;
};

/**
 * Says what the next transcode will actually use, and how much to worry about it. The interesting
 * case is an encoder forced by hand that the machine never proved it has: every transcode silently
 * falls back to software, which is the sort of thing that shows up as unexplained load rather than
 * as an error.
 *
 * @param forced - The encoder chosen by hand, or an empty string for automatic.
 * @param probed - The encoders this machine proved it can use.
 * @returns What to call it, how alarming it is, and what it means in practice.
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
        : `${name} was chosen rather than left to Valence, and the machine proved it can do it. Transcodes use it instead of the processor.`,
    };
  }

  if (probed.length === 0) {
    return {
      label: 'Software only',
      tone: 'quiet',
      detail:
        'This machine proved no hardware encoder Valence can use, so transcodes are done by the processor. Nothing was chosen — there was nothing to choose.',
    };
  }

  return {
    label: `${probed.join(', ')} · automatic`,
    tone: 'quiet',
    detail: `Valence uses whichever backend the machine proved it can do, which here is ${probed.join(' and ')}. Choose one in Settings to insist on it instead.`,
  };
};

export { describeAcceleration };
