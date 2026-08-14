import { z } from 'zod';

/**
 * The longest note an admin may send a viewer.
 *
 * A single line that fits the banner over the picture. Anything longer is a
 * conversation, and a conversation wants somewhere other than the top of
 * somebody's film.
 */
const SESSION_MESSAGE_MAX_LENGTH = 140;

/**
 * A line of text an admin sends to one watching tab.
 *
 * Carries nothing but the words on purpose: a message changes no playback, so
 * there is nothing else for it to say.
 */
const SessionMessageSchema = z.object({
  text: z.string().trim().min(1).max(SESSION_MESSAGE_MAX_LENGTH),
});

type SessionMessage = z.infer<typeof SessionMessageSchema>;

export { SessionMessageSchema, SESSION_MESSAGE_MAX_LENGTH };

export type { SessionMessage };
