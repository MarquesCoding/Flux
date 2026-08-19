import { serverUrl } from '@FluxClient/query/serverUrl';
import { JsonValueSchema } from '@FluxContracts/schemas/JsonValue';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';
import { RequestFailed } from '@FluxClient/query/RequestFailed';

/**
 * Reads something from Flux, and throws where it could not be read.
 *
 * Every failure leaves by the same door: a refusal throws `RequestFailed` carrying the status, a
 * server that cannot be reached throws whatever `fetch` threw, and a body that does not match its
 * schema throws the parse error. None of them are turned into a value, which is the whole point —
 * a query that rejects is retried by the cache, and a screen can tell being unable to read something
 * from there being nothing to read.
 *
 * An empty answer now means the server said there is nothing.
 *
 * The path is put on whichever server this client watches, which is the page's own origin in a
 * browser and an address a viewer configured in a client with a window of its own.
 *
 * @param path - What to ask for.
 * @param schema - The shape the answer must be in.
 * @param headers - Anything the request has to carry beyond asking for json, such as which face is
 *   watching, where what comes back depends on it.
 * @returns The answer, parsed.
 */
const readFromServer = async <Value>(
  path: string,
  schema: { parse: (body: JsonValue) => Value },
  headers: Record<string, string> = {},
): Promise<Value> => {
  const response = await fetch(serverUrl(path), {
    headers: { accept: 'application/json', ...headers },
  });

  if (!response.ok) {
    throw new RequestFailed(path, response.status);
  }

  const body = JsonValueSchema.parse(await response.json());

  return schema.parse(body);
};

export { readFromServer };
