import type { ScheduleTrigger } from '@ValenceClient/admin/fetchAdmin';

type DescribeTriggerInZoneOptions = {
  trigger: ScheduleTrigger;
  serverZone: string;
  viewerZone: string;
  now: Date;
};

/**
 * How far a zone is from UTC at a given instant, in milliseconds.
 *
 * Read out of `Intl` rather than from a table, because an offset is a property of the moment as well
 * as the place: the same zone is an hour different in July from January.
 *
 * @param instant - The moment to measure at.
 * @param zone - The IANA zone.
 * @returns The offset in milliseconds, positive east of UTC.
 */
const offsetAt = (instant: Date, zone: string): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const read = (type: string): number => Number(parts.find((part) => part.type === type)?.value);

  return (
    Date.UTC(
      read('year'),
      read('month') - 1,
      read('day'),
      read('hour') % 24,
      read('minute'),
      read('second'),
    ) - instant.getTime()
  );
};

/**
 * The instant at which a wall clock in one zone reads a given date and time.
 *
 * @param wall - The wall-clock reading, as UTC parts.
 * @param zone - The zone the clock is in.
 * @returns The moment that clock shows that reading.
 */
const instantOf = (wall: number, zone: string): Date =>
  new Date(wall - offsetAt(new Date(wall), zone));

/**
 * Says when a clock trigger falls on the reader's own clock, where that differs from the server's.
 *
 * The day matters as much as the hour, which is the whole reason this exists: a weekly job an
 * operator set for Sunday morning in London falls on **Saturday** through much of the United States,
 * and a label that showed only the time would hide the part that surprises somebody.
 *
 * @param options - The trigger, both zones, and the moment to read them at.
 * @returns The reader's own time, or null when there is nothing useful to add.
 */
const describeTriggerInZone = ({
  trigger,
  serverZone,
  viewerZone,
  now,
}: DescribeTriggerInZoneOptions): string | null => {
  if (serverZone === viewerZone || serverZone.length === 0 || viewerZone.length === 0) {
    return null;
  }

  if (trigger.kind !== 'daily' && trigger.kind !== 'weekly') {
    return null;
  }

  const here = new Intl.DateTimeFormat('en-CA', {
    timeZone: serverZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const read = (type: string): number => Number(here.find((part) => part.type === type)?.value);

  const dayShift =
    trigger.kind === 'weekly'
      ? (trigger.dayOfWeek -
          new Date(Date.UTC(read('year'), read('month') - 1, read('day'))).getUTCDay() +
          7) %
        7
      : 0;

  const wall = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day') + dayShift,
    trigger.hour,
    trigger.minute,
  );

  const instant = instantOf(wall, serverZone);

  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: viewerZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instant);

  if (trigger.kind === 'daily') {
    return `${clock} your time`;
  }

  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: viewerZone,
    weekday: 'long',
  }).format(instant);

  return `${day} at ${clock} your time`;
};

export type { DescribeTriggerInZoneOptions };

export { describeTriggerInZone };
