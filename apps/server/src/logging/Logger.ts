import type {
  LogContext,
  LogLevel,
  LogQuery,
  LogRecord,
  LogSource,
} from '@FluxContracts/schemas/Log';

type LogAside = {
  detail?: string;
  context?: Partial<LogContext>;
};

type Logger = {
  debug: (source: LogSource, message: string, aside?: LogAside) => void;
  info: (source: LogSource, message: string, aside?: LogAside) => void;
  warn: (source: LogSource, message: string, aside?: LogAside) => void;
  error: (source: LogSource, message: string, aside?: LogAside) => void;
  about: (context: Partial<LogContext>) => Logger;
  flush: () => Promise<void>;
};

type StoredLog = {
  id: string;
  atMs: number;
  level: LogLevel;
  source: LogSource;
  message: string;
  detail: string | null;
  context: LogContext;
  sameEventKey: string;
  forgetAfterMs: number;
};

type LogStore = {
  save: (records: readonly StoredLog[]) => Promise<void>;
  countAgain: (ids: readonly string[]) => Promise<void>;
  read: (query: LogQuery) => Promise<{ records: LogRecord[]; total: number }>;
  forgetExpired: (nowMs: number) => Promise<number>;
};

export type { Logger, LogAside, LogStore, StoredLog };
