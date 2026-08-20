import { describe, expect, it } from 'vitest';
import { aDiscordFrame, FRAME, HANDSHAKE, readDiscordFrames } from './aDiscordFrame';

describe('aDiscordFrame', () => {
  it('says what kind of message it is and how long it is, which is all that separates two', () => {
    const framed = aDiscordFrame(HANDSHAKE, '{"v":1}');

    expect(framed.readInt32LE(0)).toBe(HANDSHAKE);
    expect(framed.readInt32LE(4)).toBe(7);
    expect(framed.toString('utf8', 8)).toBe('{"v":1}');
  });

  it('counts bytes rather than characters, or the reader stops in the middle of one', () => {
    const framed = aDiscordFrame(FRAME, '{"t":"café"}');

    expect(framed.readInt32LE(4)).toBe(Buffer.byteLength('{"t":"café"}', 'utf8'));
  });
});

describe('readDiscordFrames', () => {
  it('reads a whole message back out', () => {
    const { frames, rest } = readDiscordFrames(aDiscordFrame(FRAME, '{"cmd":"DISPATCH"}'));

    expect(frames).toEqual([{ opcode: FRAME, payload: '{"cmd":"DISPATCH"}' }]);
    expect(rest.length).toBe(0);
  });

  it('reads several that arrived together, since a socket carries bytes rather than messages', () => {
    const both = Buffer.concat([aDiscordFrame(FRAME, '{"a":1}'), aDiscordFrame(FRAME, '{"b":2}')]);

    expect(readDiscordFrames(both).frames.map((frame) => frame.payload)).toEqual([
      '{"a":1}',
      '{"b":2}',
    ]);
  });

  it('keeps half a message to read again, rather than reading nonsense', () => {
    const whole = aDiscordFrame(FRAME, '{"cmd":"DISPATCH"}');
    const { frames, rest } = readDiscordFrames(whole.subarray(0, 12));

    expect(frames).toEqual([]);
    expect(rest.length).toBe(12);
  });

  it('keeps a header that has not finished arriving', () => {
    const { frames, rest } = readDiscordFrames(Buffer.from([1, 0, 0]));

    expect(frames).toEqual([]);
    expect(rest.length).toBe(3);
  });

  it('reads what it can and keeps the rest, which is the ordinary case', () => {
    const whole = aDiscordFrame(FRAME, '{"a":1}');
    const arrived = Buffer.concat([whole, aDiscordFrame(FRAME, '{"b":2}').subarray(0, 5)]);
    const { frames, rest } = readDiscordFrames(arrived);

    expect(frames).toHaveLength(1);
    expect(rest.length).toBe(5);
  });

  it('reads nothing out of nothing', () => {
    expect(readDiscordFrames(Buffer.alloc(0)).frames).toEqual([]);
  });
});
