const HEADER = 8;

const HANDSHAKE = 0;

const FRAME = 1;

type DiscordFrame = { opcode: number; payload: string };

/**
 * Wraps a message the way Discord's socket expects to read one.
 *
 * Two little-endian thirty-two bit numbers and then the JSON: what kind of message it is, and how
 * many bytes of it there are. There is no delimiter and no terminator, so the length is the only
 * thing separating one message from the next.
 *
 * @param opcode - What kind of message this is.
 * @param payload - The JSON to send.
 * @returns The bytes to write.
 */
const aDiscordFrame = (opcode: number, payload: string): Buffer => {
  const body = Buffer.from(payload, 'utf8');
  const framed = Buffer.alloc(HEADER + body.length);

  framed.writeInt32LE(opcode, 0);
  framed.writeInt32LE(body.length, 4);
  body.copy(framed, HEADER);

  return framed;
};

/**
 * Reads whole messages out of whatever has arrived so far.
 *
 * A socket hands over bytes rather than messages, so a read can carry half of one, or three and a
 * bit. Anything short of a whole message is handed back to be read again once more arrives.
 *
 * @param arrived - Everything received and not yet read.
 * @returns The whole messages, and the remainder to keep.
 */
const readDiscordFrames = (arrived: Buffer): { frames: DiscordFrame[]; rest: Buffer } => {
  const frames: DiscordFrame[] = [];
  let at = 0;

  while (arrived.length - at >= HEADER) {
    const length = arrived.readInt32LE(at + 4);

    if (arrived.length - at - HEADER < length) {
      break;
    }

    frames.push({
      opcode: arrived.readInt32LE(at),
      payload: arrived.toString('utf8', at + HEADER, at + HEADER + length),
    });

    at += HEADER + length;
  }

  return { frames, rest: arrived.subarray(at) };
};

export type { DiscordFrame };

export { aDiscordFrame, FRAME, HANDSHAKE, readDiscordFrames };
