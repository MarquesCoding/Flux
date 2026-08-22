import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';
import { readFromServer } from '@ValenceClient/query/readFromServer';
import { RequestFailed } from '@ValenceClient/query/RequestFailed';

const ABSENT = 404;

/**
 * Reads one particular thing from Valence, where the thing not being there is an answer rather than a
 * failure.
 *
 * Only a 404 is treated that way, and only for an address naming one thing: asking for a film by an
 * identifier the library no longer has is a question with a true answer, and a screen that lands on
 * such an address should say the item has gone rather than that it could not read the library.
 * Everything else — a refusal, a server that is down, a body that will not parse — throws exactly as
 * it does everywhere else.
 *
 * @param path - What to ask for.
 * @param schema - The shape the answer must be in.
 * @returns The answer, or nothing where the server said there is no such thing.
 */
const readFromServerOrAbsent = async <Value>(
  path: string,
  schema: { parse: (body: JsonValue) => Value },
): Promise<Value | null> => {
  try {
    return await readFromServer(path, schema);
  } catch (error) {
    if (error instanceof RequestFailed && error.status === ABSENT) {
      return null;
    }

    throw error;
  }
};

export { readFromServerOrAbsent };
