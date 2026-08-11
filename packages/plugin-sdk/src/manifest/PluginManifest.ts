import { z } from 'zod'
import { JsonObjectSchema } from '@FluxContracts/schemas/JsonValue'

const SEMVER_RANGE = /^[\^~]?\d+(\.\d+)?(\.\d+)?(\s*-\s*\d+(\.\d+)?(\.\d+)?)?$/

const ExtensionPointSchema = z.enum([
  'MetadataProvider',
  'LibraryScanner',
  'AuthProvider',
  'NotificationChannel',
  'RequestBackend',
  'TranscodeProfileProvider',
  'UIContribution',
])

const NetworkCapabilitySchema = z.object({
  kind: z.literal('network'),
  domains: z.array(z.string().min(1)).min(1),
})

const LibraryCapabilitySchema = z.object({
  kind: z.literal('library'),
  access: z.enum(['read']),
})

const MediaCapabilitySchema = z.object({
  kind: z.literal('media'),
  access: z.enum(['probe', 'read']),
})

const EventsCapabilitySchema = z.object({
  kind: z.literal('events'),
  topics: z.array(z.string().min(1)).min(1),
})

const StorageCapabilitySchema = z.object({
  kind: z.literal('storage'),
  quotaBytes: z.number().int().positive().max(50_000_000),
})

const CapabilitySchema = z.discriminatedUnion('kind', [
  NetworkCapabilitySchema,
  LibraryCapabilitySchema,
  MediaCapabilitySchema,
  EventsCapabilitySchema,
  StorageCapabilitySchema,
])

/**
 * The declaration a plugin ships with. Every capability the broker will grant
 * must appear here, so that the admin sees a complete permission list before
 * the plugin runs and a diff of it on update.
 *
 * See ADR-0007.
 */
const PluginManifestSchema = z.object({
  id: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z][a-z0-9-]*$/, 'Plugin ids are lowercase kebab-case'),
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+/, 'Plugin versions are semver'),
  apiVersion: z.string().regex(SEMVER_RANGE, 'apiVersion must be a semver range'),
  author: z.string().min(1),
  description: z.string().min(1).max(500),
  extensionPoints: z.array(ExtensionPointSchema).min(1),
  capabilities: z.array(CapabilitySchema),
  entry: z.string().min(1),
  settingsSchema: JsonObjectSchema.optional(),
})

export type ExtensionPoint = z.infer<typeof ExtensionPointSchema>
export type Capability = z.infer<typeof CapabilitySchema>
export type PluginManifest = z.infer<typeof PluginManifestSchema>

export { PluginManifestSchema, CapabilitySchema, ExtensionPointSchema }
