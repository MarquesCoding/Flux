import { useState } from 'react';
import { Badge } from '@FluxUI/Badge';
import { Button } from '@FluxUI/Button';
import type { LogRowProps } from './LogRow.types';

/**
 * One line of the log, opened up when asked.
 *
 * Kept whole rather than truncated: the part of a message that gets cut is the reason, and a stack
 * trace or the tail of what ffmpeg said is exactly what somebody came here to read. Shown folded so
 * that four hundred of them are still scannable, and unfolded on request rather than on hover, since
 * an operator reading one line should not have it move when the pointer drifts.
 *
 * @param record - What happened.
 * @param tone - How alarming it should look.
 * @param at - When it happened, in the reader's own time.
 * @returns The row.
 */
const LogRow = ({ record, tone, at }: LogRowProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const said = Object.entries(record.context).filter(
    (entry): entry is [string, string] => entry[1] !== null,
  );

  const hasMore = said.length > 0 || record.detail !== null;

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="shrink-0 font-mono text-xs tabular-nums text-text-muted">{at}</span>

        <Badge tone={tone} size="sm">
          {record.level}
        </Badge>

        <span className="shrink-0 text-xs text-text-muted">{record.source}</span>

        {record.count > 1 && (
          <Badge tone="quiet" size="sm">
            {`×${record.count.toString()}`}
          </Badge>
        )}

        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            isPill
            className="ml-auto"
            onClick={() => {
              setIsOpen((held) => !held);
            }}
          >
            {isOpen ? 'Less' : 'More'}
          </Button>
        )}
      </div>

      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text">
        {record.message}
      </p>

      {isOpen && (
        <div className="flex flex-col gap-2">
          {said.length > 0 && (
            <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
              {said.map(([name, value]) => (
                <div key={name} className="flex gap-1">
                  <dt>{name}</dt>
                  <dd className="font-mono text-text">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {record.detail !== null && (
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--surface-hover)] px-3 py-2 font-mono text-xs leading-relaxed text-text-muted">
              {record.detail}
            </pre>
          )}
        </div>
      )}
    </li>
  );
};

LogRow.displayName = 'LogRow';

export { LogRow };
