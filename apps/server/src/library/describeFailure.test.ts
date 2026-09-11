import { describe, expect, it } from 'vitest';
import { describeFailure } from './describeFailure';

describe('describeFailure', () => {
  it('says what a plain failure said', () => {
    expect(describeFailure(new Error('No video stream.'))).toBe('No video stream.');
  });

  it('follows the cause, which is where Node puts what actually happened', () => {
    const said = describeFailure(
      new Error('fetch failed', { cause: new Error('read ECONNRESET') }),
    );

    expect(said).toBe('fetch failed: read ECONNRESET');
  });

  it('carries the code, which names the fault where the message does not', () => {
    const underneath = Object.assign(new Error('Headers Timeout Error'), {
      code: 'UND_ERR_HEADERS_TIMEOUT',
    });

    expect(describeFailure(new Error('fetch failed', { cause: underneath }))).toBe(
      'fetch failed: Headers Timeout Error (UND_ERR_HEADERS_TIMEOUT)',
    );
  });

  it('does not say the same thing twice', () => {
    const said = describeFailure(new Error('fetch failed', { cause: new Error('fetch failed') }));

    expect(said).toBe('fetch failed');
  });

  it('stops rather than following a cause that points at itself', () => {
    const looping: Error = new Error('round');
    looping.cause = looping;

    expect(describeFailure(looping)).toBe('round');
  });

  it('says something even for an error carrying no message', () => {
    expect(describeFailure(new Error(''))).toBe('Probe failed.');
  });
  it('reads the attempts gathered in an AggregateError, which carries no message of its own', () => {
    const refused = new Error('connect ECONNREFUSED 127.0.0.1:8420');

    Object.assign(refused, { code: 'ECONNREFUSED' });

    const said = describeFailure(
      new Error('fetch failed', { cause: new AggregateError([refused], '') }),
    );

    expect(said).toBe('fetch failed: connect ECONNREFUSED 127.0.0.1:8420 (ECONNREFUSED)');
  });

  it('prefers the cause of a gathering error where it was given one', () => {
    const gathering = new AggregateError([new Error('second')], 'tried everything', {
      cause: new Error('first'),
    });

    expect(describeFailure(gathering)).toBe('tried everything: first');
  });

  it('says something for a gathering error that gathered nothing', () => {
    expect(describeFailure(new AggregateError([], ''))).toBe('Probe failed.');
  });
});
