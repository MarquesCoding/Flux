import { RiCloseLine } from '@remixicon/react';
import { Dialog } from '@FluxUI/Dialog';
import { DialogContent } from '@FluxUI/DialogContent';
import { DialogTitle } from '@FluxUI/DialogTitle';
import { Button } from '@FluxUI/Button';
import { describeLogDay, describeLogTime } from '@FluxWeb/admin/describeLogTime';
import type { LogDetailDialogProps } from './LogDetailDialog.types';

type RowProps = {
  name: string;
  children: string;
};

/**
 * One labelled fact about the record, laid out so the labels line up and long values wrap rather
 * than pushing the dialog wide.
 *
 * @param name - What the fact is.
 * @param children - The fact itself.
 */
const Row = ({ name, children }: RowProps) => (
  <div className="flex gap-3 rounded-md px-1 py-1.5 text-sm">
    <dt className="w-28 shrink-0 text-text-muted">{name}</dt>
    <dd className="min-w-0 break-words font-medium text-text">{children}</dd>
  </div>
);

Row.displayName = 'Row';

/**
 * Everything known about one log record.
 *
 * Opened rather than shown in the row because the part of a message that would be cut is the reason,
 * and a stack trace or the tail of what ffmpeg said is exactly what somebody came here to read —
 * neither of which fits a table row without ruining the table.
 *
 * @param record - The record being read, or null when none is.
 * @param isOpen - Whether the dialog is showing.
 * @param onClose - Called when it is dismissed.
 * @returns The dialog.
 */
const LogDetailDialog = ({ record, isOpen, onClose }: LogDetailDialogProps) => {
  const said =
    record === null
      ? []
      : Object.entries(record.context).filter(
          (entry): entry is [string, string] => entry[1] !== null,
        );

  return (
    <Dialog label="Log record" isOpen={isOpen && record !== null} onClose={onClose}>
      <DialogTitle title="Log record">
        <Button isIconOnly variant="ghost" label="Close" size="sm" onClick={onClose}>
          <RiCloseLine size={16} aria-hidden />
        </Button>
      </DialogTitle>

      <DialogContent>
        {record !== null && (
          <div className="flex flex-col gap-4">
            <dl className="flex flex-col divide-y divide-[var(--surface-line)]">
              <Row name="When">{`${describeLogDay(record.atMs)} at ${describeLogTime(record.atMs)}`}</Row>
              <Row name="Level">{record.level}</Row>
              <Row name="Source">{record.source}</Row>

              {record.count > 1 && <Row name="Happened">{`${record.count.toString()} times`}</Row>}

              {said.map(([name, value]) => (
                <Row key={name} name={name}>
                  {value}
                </Row>
              ))}
            </dl>

            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text">
              {record.message}
            </p>

            {record.detail !== null && (
              <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--surface-hover)] px-3 py-2 font-mono text-xs leading-relaxed text-text-muted">
                {record.detail}
              </pre>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

LogDetailDialog.displayName = 'LogDetailDialog';

export { LogDetailDialog };
