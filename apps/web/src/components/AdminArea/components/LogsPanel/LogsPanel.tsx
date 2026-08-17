import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@FluxUI/Button';
import { Card } from '@FluxUI/Card';
import { CardHeader } from '@FluxUI/CardHeader';
import { Switch } from '@FluxUI/Switch';
import { TextField } from '@FluxUI/TextField';
import { LOG_LEVELS, LOG_SOURCES } from '@FluxContracts/schemas/Log';
import { fetchLogs, watchLogs } from '@FluxWeb/admin/fetchLogs';
import { logsAsText } from '@FluxWeb/admin/logsAsText';
import { matchesLogQuery } from '@FluxWeb/admin/matchesLogQuery';
import { downloadText } from '@FluxWeb/admin/downloadText';
import { describeLogTime } from '@FluxWeb/admin/describeLogTime';
import { LogRow } from './components/LogRow/LogRow';
import type { BadgeTone } from '@FluxUI/Badge.types';
import type { LogLevel, LogRecord, LogSource } from '@FluxContracts/schemas/Log';
import type { LogsPanelProps } from './LogsPanel.types';

const PAGE = 300;

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
 * Warnings and errors are shown to begin with rather than everything, because an operator opening
 * this has a problem rather than a curiosity, and four thousand lines saying a file was read
 * successfully bury the one saying a file was not.
 *
 * Following is deliberately not the same as scrolling. New records arrive at the top, and while the
 * reader is anywhere but the top the view stays where they left it — a tail that yanks somebody away
 * from the line they were reading is worse than no tail at all. The filters apply to what arrives
 * live as well as to what was fetched, or watching for errors would quietly show everything.
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
  const [levels, setLevels] = useState<LogLevel[]>(['warn', 'error']);
  const [sources, setSources] = useState<LogSource[]>([]);
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState<LogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [isFollowing, setIsFollowing] = useState(true);
  const [isReading, setIsReading] = useState(false);
  const [copied, setCopied] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const isAtTop = useRef(true);

  const query = useMemo(
    () => ({ levels, sources, search, limit: PAGE }),
    [levels, sources, search],
  );

  const load = useCallback(async () => {
    setIsReading(true);

    const page = await read(query);

    setRecords(page.records);
    setTotal(page.total);
    setIsReading(false);
  }, [read, query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isFollowing) {
      return;
    }

    return watch((record) => {
      if (!matchesLogQuery(record, query)) {
        return;
      }

      setRecords((held) => [record, ...held].slice(0, KEPT_WHILE_FOLLOWING));
      setTotal((held) => held + 1);

      if (isAtTop.current && listRef.current !== null) {
        listRef.current.scrollTop = 0;
      }
    });
  }, [watch, query, isFollowing]);

  const toggle = <Choice extends string>(held: Choice[], one: Choice): Choice[] =>
    held.includes(one) ? held.filter((kept) => kept !== one) : [...held, one];

  const asText = () => logsAsText(records);

  return (
    <div className="flex flex-col gap-4">
      <Card as="section" className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-text-muted">
          What the server and the media service have reported, newest first. Warnings and errors to
          begin with; turn on the rest when looking for something specific.
        </p>

        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
            Level
          </legend>

          <ul className="flex flex-wrap gap-2">
            {LOG_LEVELS.map((level) => (
              <li key={level}>
                <Button
                  size="sm"
                  isPill
                  variant={levels.includes(level) ? 'glossy' : 'ghost'}
                  isActive={levels.includes(level)}
                  onClick={() => {
                    setLevels((held) => toggle(held, level));
                  }}
                >
                  {level}
                </Button>
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
            Source
          </legend>

          <ul className="flex flex-wrap gap-2">
            {LOG_SOURCES.map((source) => (
              <li key={source}>
                <Button
                  size="sm"
                  isPill
                  variant={sources.includes(source) ? 'glossy' : 'ghost'}
                  isActive={sources.includes(source)}
                  onClick={() => {
                    setSources((held) => toggle(held, source));
                  }}
                >
                  {source}
                </Button>
              </li>
            ))}
          </ul>
        </fieldset>

        <TextField
          label="Search the messages"
          value={search}
          onValueChange={setSearch}
          type="search"
          isPill
          placeholder="skipped, ffmpeg, timed out"
        />
      </Card>

      <Card as="section" padding="none" className="flex flex-col overflow-hidden">
        <CardHeader title={`${total.toString()} record${total === 1 ? '' : 's'}`}>
          <div className="flex flex-wrap items-center gap-2">
            <Switch
              label="Follow live"
              isOn={isFollowing}
              onToggle={() => {
                setIsFollowing((held) => !held);
              }}
            />

            <Button
              variant="ghost"
              size="sm"
              isPill
              onClick={() => {
                void load();
              }}
            >
              Refresh
            </Button>

            <Button
              variant="ghost"
              size="sm"
              isPill
              onClick={() => {
                void copy(asText()).then(() => {
                  setCopied(true);
                });
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              isPill
              onClick={() => {
                download('flux-log.txt', asText());
              }}
            >
              Download
            </Button>
          </div>
        </CardHeader>

        <div
          ref={listRef}
          onScroll={(event) => {
            isAtTop.current = event.currentTarget.scrollTop <= 8;
          }}
          className="max-h-[34rem] overflow-y-auto"
          data-testid="log-list"
        >
          {records.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-text-muted">
              {isReading
                ? 'Reading the log…'
                : 'Nothing has been reported that matches this. Widen the levels, or clear the search.'}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--surface-line)]">
              {records.map((record) => (
                <LogRow
                  key={record.id}
                  record={record}
                  tone={TONE_BY_LEVEL[record.level]}
                  at={describeLogTime(record.atMs)}
                />
              ))}
            </ul>
          )}
        </div>

        <p className="border-t border-[var(--surface-line)] px-4 py-3 text-xs leading-relaxed text-text-muted">
          {records.length < total ? `Showing the newest ${records.length.toString()}. ` : ''}A log
          quotes file paths, which say how the library is laid out and what is on the disk. Read
          what you are about to send before sending it.
        </p>
      </Card>
    </div>
  );
};

LogsPanel.displayName = 'LogsPanel';

export { LogsPanel };
