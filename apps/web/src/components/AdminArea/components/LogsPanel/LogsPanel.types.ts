import type { LogQuery, LogRecord } from '@FluxContracts/schemas/Log';
import type { LogPage } from '@FluxWeb/admin/fetchLogs';

type LogsPanelProps = {
  read?: (query: Partial<LogQuery>) => Promise<LogPage>;
  watch?: (onRecord: (record: LogRecord) => void) => () => void;
  copy?: (text: string) => Promise<void>;
  download?: (name: string, text: string) => void;
};

export type { LogsPanelProps };
