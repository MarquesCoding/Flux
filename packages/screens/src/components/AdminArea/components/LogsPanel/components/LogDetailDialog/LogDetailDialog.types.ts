import type { LogRecord } from '@ValenceContracts/schemas/Log';

type LogDetailDialogProps = {
  record: LogRecord | null;
  isOpen: boolean;
  onClose: () => void;
};

export type { LogDetailDialogProps };
