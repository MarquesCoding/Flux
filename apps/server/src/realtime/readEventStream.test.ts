import { describe, expect, it } from 'vitest';
import { readEventStream } from './readEventStream';

const streamOf = (chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start: (controller) => {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    },
  });
};

const collect = async (chunks: string[]): Promise<string[]> => {
  const found: string[] = [];

  for await (const payload of readEventStream(streamOf(chunks))) {
    found.push(payload);
  }

  return found;
};

describe('readEventStream', () => {
  it('reads a single frame', async () => {
    expect(await collect(['data: {"ok":true}\n\n'])).toStrictEqual(['{"ok":true}']);
  });

  it('reads several frames arriving together', async () => {
    expect(await collect(['data: one\n\ndata: two\n\n'])).toStrictEqual(['one', 'two']);
  });

  it('waits for a frame split across chunks rather than reading half of it', async () => {
    expect(await collect(['data: {"ok"', ':true}\n\n'])).toStrictEqual(['{"ok":true}']);
  });

  it('reads a frame whose boundary itself is split', async () => {
    expect(await collect(['data: one\n', '\ndata: two\n\n'])).toStrictEqual(['one', 'two']);
  });

  it('skips a keep-alive ping, which carries nothing', async () => {
    expect(await collect([': ping\n\ndata: one\n\n'])).toStrictEqual(['one']);
  });

  it('joins a payload written over several data lines', async () => {
    expect(await collect(['data: one\ndata: two\n\n'])).toStrictEqual(['one\ntwo']);
  });

  it('gives nothing for a stream that closed without saying anything', async () => {
    expect(await collect([])).toStrictEqual([]);
  });

  it('drops a trailing frame that never finished, rather than reading it half-written', async () => {
    expect(await collect(['data: whole\n\ndata: cut off'])).toStrictEqual(['whole']);
  });
});
