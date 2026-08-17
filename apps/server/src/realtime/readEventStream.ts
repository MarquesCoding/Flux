const FRAME = '\n\n';

const DATA = 'data:';

/**
 * Reads the payloads out of a server-sent event stream, one at a time as they arrive.
 *
 * The server consumes the transcoder's stream once and hands what it finds to everybody watching,
 * rather than opening a fresh connection to the transcoder for every administrator with the page
 * open. Comment frames, which are what a keep-alive ping is, carry nothing and are skipped.
 *
 * @param stream - The bytes coming back from the transcoder.
 * @returns Each payload, in the order it arrived.
 */
const readEventStream = async function* (
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let held = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        return;
      }

      held += decoder.decode(value, { stream: true });

      let at = held.indexOf(FRAME);

      while (at >= 0) {
        const frame = held.slice(0, at);

        held = held.slice(at + FRAME.length);
        at = held.indexOf(FRAME);

        const payload = frame
          .split('\n')
          .filter((line) => line.startsWith(DATA))
          .map((line) => line.slice(DATA.length).trimStart())
          .join('\n');

        if (payload !== '') {
          yield payload;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
};

export { readEventStream };
