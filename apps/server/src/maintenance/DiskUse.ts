import { z } from 'zod';

/**
 * One mounted filesystem, as the media service measures it.
 *
 * Parsed rather than trusted: the monitor arrives as an opaque JSON value
 * proxied from another process, and a reading Flux is going to act on has to
 * come through a schema like any other untrusted input.
 */
const DiskUseSchema = z.object({
  mountPoint: z.string().min(1),
  totalBytes: z.number().nonnegative(),
  availableBytes: z.number().nonnegative(),
});

/**
 * The part of the monitor Flux reads here.
 *
 * Everything else the monitor carries — processors, memory, graphics — is
 * passed through to the admin page untouched and is none of this module's
 * business.
 */
const MonitorDisksSchema = z.object({
  resources: z.object({ disks: z.array(DiskUseSchema).default([]) }).default({ disks: [] }),
});

type DiskUse = z.infer<typeof DiskUseSchema>;

export { DiskUseSchema, MonitorDisksSchema };

export type { DiskUse };
