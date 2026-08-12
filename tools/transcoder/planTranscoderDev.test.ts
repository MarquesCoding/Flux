import { describe, expect, it } from 'vitest';
import { planTranscoderDev } from './planTranscoderDev';

describe('planTranscoderDev', () => {
  it('starts the media service on the socket the server dials', () => {
    const plan = planTranscoderDev({
      transcoderUrl: 'unix:/tmp/flux-transcoder.sock',
      isRustInstalled: true,
    });

    expect(plan).toEqual({ kind: 'run', socketPath: '/tmp/flux-transcoder.sock' });
  });

  it('stops with the variable to set when nothing names an address', () => {
    const plan = planTranscoderDev({ transcoderUrl: undefined, isRustInstalled: true });

    expect(plan.kind).toBe('stop');
    expect(plan.kind === 'stop' && plan.message).toContain('TRANSCODER_URL');
  });

  it('treats a variable set to nothing as one not set at all', () => {
    const plan = planTranscoderDev({ transcoderUrl: '   ', isRustInstalled: true });

    expect(plan.kind).toBe('stop');
  });

  it('leaves a media service on another machine alone', () => {
    const plan = planTranscoderDev({
      transcoderUrl: 'http://transcoder.internal:9000',
      isRustInstalled: false,
    });

    expect(plan.kind).toBe('skip');
  });

  it('asks for Rust only when it would be the thing to run', () => {
    const plan = planTranscoderDev({
      transcoderUrl: 'unix:/tmp/flux-transcoder.sock',
      isRustInstalled: false,
    });

    expect(plan.kind).toBe('stop');
    expect(plan.kind === 'stop' && plan.message).toContain('rustup.rs');
  });
});
