import type { BadgeTone } from '@FluxUI/Badge.types';
import type { LogRecord } from '@FluxContracts/schemas/Log';

type LogRowProps = {
  record: LogRecord;
  tone: BadgeTone;
  at: string;
};

export type { LogRowProps };
