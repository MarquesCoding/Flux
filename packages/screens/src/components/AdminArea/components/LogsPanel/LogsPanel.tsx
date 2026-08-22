import { Icon } from '@ValenceUI/Icon';
import {
  ArrowsClockwiseIcon,
  CheckIcon,
  CopyIcon,
  DownloadSimpleIcon,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@ValenceUI/Badge';
import { Button } from '@ValenceUI/Button';
import { DataTable } from '@ValenceUI/DataTable';
import { TextField } from '@ValenceUI/TextField';
import { LOG_LEVELS } from '@ValenceContracts/schemas/Log';
import { fetchLogs, watchLogs } from '@ValenceClient/admin/fetchLogs';
import { logsAsText } from '@ValenceClient/admin/logsAsText';
import { matchesLogQuery } from '@ValenceClient/admin/matchesLogQuery';
import { downloadText } from '@ValenceScreens/admin/downloadText';
import { describeLogTime } from '@ValenceClient/admin/describeLogTime';
import { LogDetailDialog } from './components/LogDetailDialog/LogDetailDialog';
import type { BadgeTone } from '@ValenceUI/Badge.types';
import type { DataTableColumn } from '@ValenceUI/DataTable.types';
import type { LogLevel, LogRecord } from '@ValenceContracts/schemas/Log';
import type { LogsPanelProps } from './LogsPanel.types';

const PAGE = 300;

const ROWS_PER_PAGE = 15;

const KEPT_WHILE_FOLLOWING = 500;

const TONE_BY_LEVEL: Readonly<Record<LogLevel, BadgeTone>> = {
  debug: 'quiet',
  info: 'quiet',
  warn: 'warning',
  error: 'danger',
};

const writeToClipboard = async (text: string): Promise<void> => {
  await navigator.clipboard.writeText(text);
};

/**
 * Reads the server's log without reaching for a terminal.
 *
 * The log follows itself: records arrive as they are written rather than on a button, because
 * somebody watching this page is watching for something to happen. What arrives is held to the same
 * search the page was fetched with, or watching for one thing would quietly show everything.
 *
 * Level and source are columns rather than a bank of filters above the table, so they sort like
 * every other table here, and a message long enough to matter is read in full by opening the record
 * rather than by being cut to fit a row.
 *
 * @param read - How a page is fetched, injectable for tests.
 * @param watch - How the live feed is followed, injectable for tests.
 * @param copy - How text reaches the clipboard.
 * @param download - How a file is handed over.
 * @returns The panel.
 */
const LogsPanel = ({
  read = fetchLogs,
  watch = watchLogs,
  copy = writeToClipboard,
  download = downloadText,
}: LogsPanelProps) => {
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState<LogRecord[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reading, setReading] = useState<LogRecord | null>(null);

  const hasRead = useRef(false);

  const query = useMemo(() => ({ levels: [...LOG_LEVELS], search, limit: PAGE }), [search]);

  const load = useCallback(async () => {
    setIsReading(true);

    const page = await read(query);

    setRecords(page.records);
    setIsReading(false);
    hasRead.current = true;
  }, [read, query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(
    () =>
      watch((record) => {
        if (matchesLogQuery(record, query)) {
          setRecords((held) => [record, ...held].slice(0, KEPT_WHILE_FOLLOWING));
        }
      }),
    [watch, query],
  );

  const columns = useMemo<DataTableColumn<LogRecord>[]>(
    () => [
      {
        id: 'at',
        header: 'Time',
        accessorFn: (record) => record.atMs,
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums text-text-muted">
            {describeLogTime(row.original.atMs)}
          </span>
        ),
      },
      {
        id: 'level',
        header: 'Level',
        accessorFn: (record) => record.level,
        cell: ({ row }) => (
          <Badge size="sm" tone={TONE_BY_LEVEL[row.original.level]}>
            {row.original.level}
          </Badge>
        ),
      },
      {
        id: 'source',
        header: 'Source',
        accessorFn: (record) => record.source,
        cell: ({ row }) => (
          <span className="font-body text-xs text-text-muted">{row.original.source}</span>
        ),
      },
      {
        id: 'message',
        header: 'Message',
        accessorFn: (record) => record.message,
        cell: ({ row }) => (
          <span className="line-clamp-2 min-w-0 break-words text-sm text-text">
            {row.original.message}
          </span>
        ),
      },
      {
        id: 'count',
        header: 'Seen',
        accessorFn: (record) => record.count,
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-text-muted">
            {row.original.count > 1 ? `×${row.original.count.toString()}` : '—'}
          </span>
        ),
      },
    ],
    [],
  );

  const asText = () => logsAsText(records);

  return (
    <section className="flex flex-col">
      <div className="flex flex-wrap items-center justify-end gap-2 px-5 pb-3 pt-1">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <TextField
            label="Search the messages"
            isLabelHidden
            size="sm"
            isPill
            type="search"
            placeholder="skipped, ffmpeg, timed out"
            value={search}
            onValueChange={setSearch}
            className="w-64 max-w-full"
          />

          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            isPill
            label="Read the log again"
            hasTooltip
            isLoading={isReading && hasRead.current}
            onClick={() => {
              void load();
            }}
          >
            <Icon of={ArrowsClockwiseIcon} size={15} />
          </Button>

          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            isPill
            label={copied ? 'Copied' : 'Copy what is shown'}
            hasTooltip
            onClick={() => {
              void copy(asText()).then(() => {
                setCopied(true);
              });
            }}
          >
            {copied ? <Icon of={CheckIcon} size={15} /> : <Icon of={CopyIcon} size={15} />}
          </Button>

          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            isPill
            label="Download what is shown"
            hasTooltip
            onClick={() => {
              download('valence-log.txt', asText());
            }}
          >
            <Icon of={DownloadSimpleIcon} size={15} />
          </Button>
        </div>
      </div>

      <DataTable
        label="What the server and the media service have reported"
        columns={columns}
        rows={records}
        pageSize={ROWS_PER_PAGE}
        onChooseRow={setReading}
        emptyMessage={
          isReading && !hasRead.current
            ? 'Reading the log…'
            : 'Nothing has been reported that matches this.'
        }
      />

      <p className="border-t border-[var(--surface-line)] px-5 py-3 text-xs leading-relaxed text-text-muted">
        A log quotes file paths, which say how the library is laid out and what is on the disk. Read
        what you are about to send before sending it.
      </p>

      <LogDetailDialog
        record={reading}
        isOpen={reading !== null}
        onClose={() => {
          setReading(null);
        }}
      />
    </section>
  );
};

LogsPanel.displayName = 'LogsPanel';

export { LogsPanel };
