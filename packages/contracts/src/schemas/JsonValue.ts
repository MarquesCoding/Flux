import { z } from 'zod'

type JsonPrimitive = string | number | boolean | null

type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

const JsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

/**
 * Any value expressible in JSON.
 *
 * Exists so that genuinely open-ended payloads — plugin settings schemas,
 * plugin RPC arguments — can be typed and validated without reaching for
 * `unknown`, which the code standards ban.
 */
const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([JsonPrimitiveSchema, z.array(JsonValueSchema), z.record(z.string(), JsonValueSchema)]),
)

const JsonObjectSchema = z.record(z.string(), JsonValueSchema)

export type { JsonPrimitive, JsonValue }

export default { JsonValueSchema, JsonPrimitiveSchema, JsonObjectSchema }
