import { z } from 'zod';

const DiskUseSchema = z.object({
  mountPoint: z.string().min(1),
  totalBytes: z.number().nonnegative(),
  availableBytes: z.number().nonnegative(),
});

const MonitorDisksSchema = z.object({
  resources: z.object({ disks: z.array(DiskUseSchema).default([]) }).default({ disks: [] }),
});

type DiskUse = z.infer<typeof DiskUseSchema>;

export { DiskUseSchema, MonitorDisksSchema };

export type { DiskUse };
