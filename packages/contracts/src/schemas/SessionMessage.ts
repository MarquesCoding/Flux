import { z } from 'zod';

const SESSION_MESSAGE_MAX_LENGTH = 140;

const SessionMessageSchema = z.object({
  text: z.string().trim().min(1).max(SESSION_MESSAGE_MAX_LENGTH),
});

type SessionMessage = z.infer<typeof SessionMessageSchema>;

export type { SessionMessage };

export { SessionMessageSchema, SESSION_MESSAGE_MAX_LENGTH };
