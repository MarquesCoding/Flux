const UNIX_PREFIX = 'unix:';

type DevPlan =
  | { kind: 'run'; socketPath: string }
  | { kind: 'skip'; message: string }
  | { kind: 'stop'; message: string };

type PlanTranscoderDevOptions = {
  transcoderUrl: string | undefined;
  isRustInstalled: boolean;
};

/**
 * Decides whether the media service can be started, and says why when it cannot.
 */
const planTranscoderDev = ({
  transcoderUrl,
  isRustInstalled,
}: PlanTranscoderDevOptions): DevPlan => {
  const url = transcoderUrl?.trim() ?? '';

  if (url.length === 0) {
    return {
      kind: 'stop',
      message: [
        'TRANSCODER_URL is not set, so the server and the media service have no address to agree on.',
        'Copy .env.example to .env, or set TRANSCODER_URL=unix:/tmp/flux-transcoder.sock.',
      ].join('\n'),
    };
  }

  if (!url.startsWith(UNIX_PREFIX)) {
    return {
      kind: 'skip',
      message: `TRANSCODER_URL is ${url}, so the media service is expected to be running elsewhere. Nothing to start here.`,
    };
  }

  if (!isRustInstalled) {
    return {
      kind: 'stop',
      message: [
        'The media service is Rust, and cargo was not found on this machine.',
        'Install it from https://rustup.rs, then run pnpm dev again.',
      ].join('\n'),
    };
  }

  return { kind: 'run', socketPath: url.slice(UNIX_PREFIX.length) };
};

export type { DevPlan, PlanTranscoderDevOptions };

export { planTranscoderDev, UNIX_PREFIX };
