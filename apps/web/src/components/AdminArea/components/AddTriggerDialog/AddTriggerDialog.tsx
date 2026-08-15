import { useState } from 'react';
import { RiExpandUpDownLine } from '@remixicon/react';
import { Button } from '@FluxUI/Button';
import { Dialog } from '@FluxUI/Dialog';
import { DialogContent } from '@FluxUI/DialogContent';
import { DialogFooter } from '@FluxUI/DialogFooter';
import { DialogTitle } from '@FluxUI/DialogTitle';
import { OptionMenu } from '@FluxUI/OptionMenu';
import { TextField } from '@FluxUI/TextField';
import { DAY_NAMES } from '@FluxWeb/admin/describeTrigger';
import type { ScheduleTrigger } from '@FluxWeb/admin/fetchAdmin';
import type { AddTriggerDialogProps } from './AddTriggerDialog.types';

/**
 * The kinds of trigger as an operator picks them, which is not quite how they
 * are stored.
 *
 * "On an interval" is one choice here and two stored kinds — a step in
 * minutes and a step in hours — because an operator thinks "every 15 minutes"
 * and "every 6 hours" as the same decision with a different unit, while cron
 * needs them in different fields.
 */
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
 * Reads an `HH:MM` field back into the numbers a trigger is stored with.
 *
 * Null for anything a time field can still be holding mid-edit, such as an
 * empty value or a half-typed hour.
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
 * Adds one trigger to a job, Jellyfin's Add Trigger dialog style: pick what
 * kind of trigger it is, then answer only what that kind needs.
 *
 * The Add button stays disabled rather than reporting a fault, because every
 * way of getting it wrong here is a half-finished field — a blank time, an
 * interval of nothing — and a field that is not filled in yet is not an
 * error worth telling somebody about.
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
            <RiExpandUpDownLine size={15} className="shrink-0 text-text-muted" aria-hidden />
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
        <Button variant="secondary" isPill onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>

        <Button
          variant="glossy"
          isPill
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
