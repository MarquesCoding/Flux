import type { LogRecord } from '@FluxContracts/schemas/Log';

type LogDetailDialogProps = {
  record: LogRecord | null;
  isOpen: boolean;
  onClose: () => void;
};

export type { LogDetailDialogProps };
