import { z } from 'zod';
import { PermissionSchema } from './Permission';

const ApiKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  start: z.string().nullable(),
  enabled: z.boolean(),
  expiresAt: z.string().datetime().nullable(),
  lastRequestAt: z.string().datetime().nullable(),
  requestCount: z.number().int().nonnegative(),
  permissions: z.array(PermissionSchema).nullable(),
  rateLimit: z
    .object({ max: z.number().int().positive(), everySeconds: z.number().int().positive() })
    .nullable(),
  createdAt: z.string().datetime(),
});

const CreatedApiKeySchema = ApiKeySchema.extend({ key: z.string() });

const CreateApiKeyRequestSchema = z.object({
  name: z.string().min(1).max(100),
  expiresInDays: z.number().int().positive().max(3650).nullable().default(null),
  permissions: z.array(PermissionSchema).nullable().default(null),
  rateLimit: z
    .object({
      max: z.number().int().positive().max(100_000),
      everySeconds: z.number().int().positive().max(86_400),
    })
    .nullable()
    .default(null),
});

const UpdateApiKeyRequestSchema = z.object({
  enabled: z.boolean(),
});

type ApiKey = z.infer<typeof ApiKeySchema>;
type CreatedApiKey = z.infer<typeof CreatedApiKeySchema>;
type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequestSchema>;

export type { ApiKey, CreatedApiKey, CreateApiKeyRequest };

export { ApiKeySchema, CreatedApiKeySchema, CreateApiKeyRequestSchema, UpdateApiKeyRequestSchema };
