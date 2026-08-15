import { z } from 'zod';

type Refusal = { message: string } | null;

/**
 * Reads why the server refused, if it did.
 *
 * @param response - The answer to an administrative request.
 * @returns The server's own words where it gave any, or null when it did not refuse at all.
 */
const readRefusal = async (response: Response): Promise<Refusal> => {
  if (response.ok) {
    return null;
  }

  const body = await response
    .json()
    .then((value) => z.object({ error: z.string() }).safeParse(value))
    .catch(() => null);

  return {
    message:
      body?.success === true ? body.data.error : 'That could not be done. Try again in a moment.',
  };
};

export type { Refusal };

export { readRefusal };
