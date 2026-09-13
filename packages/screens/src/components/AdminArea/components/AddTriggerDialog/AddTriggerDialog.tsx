import { Icon } from '@ValenceUI/Icon';
import { UnfoldMoreIcon } from '@hugeicons/core-free-icons';
import { useState } from 'react';
import { Button } from '@ValenceUI/Button';
import { Dialog } from '@ValenceUI/Dialog';
import { DialogContent } from '@ValenceUI/DialogContent';
import { DialogFooter } from '@ValenceUI/DialogFooter';
import { DialogTitle } from '@ValenceUI/DialogTitle';
import { OptionMenu } from '@ValenceUI/OptionMenu';
import { TextField } from '@ValenceUI/TextField';
import { DAY_NAMES } from '@ValenceClient/admin/describeTrigger';
import type { ScheduleTrigger } from '@ValenceClient/admin/fetchAdmin';
import type { AddTriggerDialogProps } from './AddTriggerDialog.types';

const TRIGGER_TYPES = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'interval', label: 'On an interval' },
  { id: 'startup', label: 'On application startup' },
] as const;
type TriggerType = (typeof TRIGGER_TYPES)[number]['id'];

const INTERVAL_UNITS = [
  { id: 'minutes', label: 'Minutes' },
  { id: 'hours', label: 'Hours' },
] as const;
type IntervalUnit = (typeof INTERVAL_UNITS)[number]['id'];

/**
 * Reads an `HH:MM` field back into the hours and minutes a trigger is stored as.
 *
 * @param value - What the time field holds.
 * @returns The hour and minute.
 */
const readClock = (value: string): { hour: number; minute: number } | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  const hour = Number.parseInt(match?.[1] ?? '', 10);
  const minute = Number.parseInt(match?.[2] ?? '', 10);

  if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) {
    return null;
  }

  return { hour, minute };
};

/**
 * Adds one trigger to a job: pick what kind it is — daily, weekly, on an interval, or when the server
 * starts — and then answer only what that kind needs, rather than being shown every field a trigger
 * of any kind could have.
 *
 * @param isOpen - Whether the dialog is showing.
 * @param onAdd - Called with the trigger that was described.
 * @param onClose - Called when it is dismissed.
 * @param isSaving - Whether a trigger is being written, which holds the dialog open and inert.
 */
const AddTriggerDialog = ({ isOpen, onAdd, onClose, isSaving = false }: AddTriggerDialogProps) => {
  const [type, setType] = useState<TriggerType>('daily');
  const [time, setTime] = useState('03:00');
  const [dayOfWeek, setDayOfWeek] = useState('0');
  const [every, setEvery] = useState('6');
  const [unit, setUnit] = useState<IntervalUnit>('hours');

  const build = (): ScheduleTrigger | null => {
    if (type === 'startup') {
      return { kind: 'startup' };
    }

    if (type === 'interval') {
      const count = Number.parseInt(every, 10);

      if (Number.isNaN(count) || count < 1) {
        return null;
      }

      if (unit === 'minutes') {
        return count > 59 ? null : { kind: 'everyMinutes', minutes: count };
      }

      return count > 23 ? null : { kind: 'everyHours', hours: count };
    }

    const clock = readClock(time);

    if (clock === null) {
      return null;
    }

    if (type === 'daily') {
      return { kind: 'daily', hour: clock.hour, minute: clock.minute };
    }

    return {
      kind: 'weekly',
      dayOfWeek: Number.parseInt(dayOfWeek, 10),
      hour: clock.hour,
      minute: clock.minute,
    };
  };

  const built = build();

  const select = (
    label: string,
    selectedId: string,
    selectedLabel: string,
    options: { id: string; label: string }[],
    onSelect: (id: string) => void,
  ) => (
    <fieldset className="flex min-w-0 flex-1 flex-col gap-1.5">
      <legend className="text-sm font-medium text-text">{label}</legend>

      <OptionMenu
        label={label}
        groups={[{ name: label, selectedId, onSelect, options }]}
        trigger={
          <>
            <span className="truncate">{selectedLabel}</span>
            <Icon of={UnfoldMoreIcon} size={15} className="shrink-0 text-text-muted" />
          </>
        }
        triggerShape="field"
        align="start"
        matchTriggerWidth
      />
    </fieldset>
  );

  return (
    <Dialog label="Add trigger" isOpen={isOpen} onClose={onClose}>
      <DialogTitle title="Add trigger" />

      <DialogContent className="flex flex-col gap-5">
        {select(
          'Trigger type',
          type,
          TRIGGER_TYPES.find((candidate) => candidate.id === type)?.label ?? '',
          [...TRIGGER_TYPES],
          (id) => {
            setType(TRIGGER_TYPES.find((candidate) => candidate.id === id)?.id ?? 'daily');
          },
        )}

        {type === 'weekly'
          ? select(
              'Day',
              dayOfWeek,
              DAY_NAMES[Number.parseInt(dayOfWeek, 10)] ?? '',
              DAY_NAMES.map((name, index) => ({ id: index.toString(), label: name })),
              setDayOfWeek,
            )
          : null}

        {type === 'daily' || type === 'weekly' ? (
          <TextField label="Time" type="time" value={time} onValueChange={setTime} />
        ) : null}

        {type === 'interval' ? (
          <div className="flex items-end gap-3">
            <TextField
              label="Every"
              type="number"
              min={1}
              max={unit === 'minutes' ? 59 : 23}
              value={every}
              onValueChange={setEvery}
              className="min-w-0 flex-1"
            />

            {select(
              'Unit',
              unit,
              INTERVAL_UNITS.find((candidate) => candidate.id === unit)?.label ?? '',
              [...INTERVAL_UNITS],
              (id) => {
                setUnit(INTERVAL_UNITS.find((candidate) => candidate.id === id)?.id ?? 'hours');
              },
            )}
          </div>
        ) : null}

        {type === 'startup' ? (
          <p className="text-sm text-text-muted">
            Runs once every time the server starts, with nothing else to set.
          </p>
        ) : null}
      </DialogContent>

      <DialogFooter>
        <Button variant="secondary" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>

        <Button
          variant="primary"
          isLoading={isSaving}
          disabled={built === null || isSaving}
          onClick={() => {
            if (built !== null) {
              onAdd(built);
            }
          }}
        >
          Add
        </Button>
      </DialogFooter>
    </Dialog>
  );
};

AddTriggerDialog.displayName = 'AddTriggerDialog';

export { AddTriggerDialog };
