const FIXED_OFFSET = /^[+-]\d{2}:?\d{2}$/u;

/**
 * Whether a string names a timezone a schedule can be trusted to keep.
 *
 * `Intl` is the authority on what exists, but it is not enough on its own: it accepts `+01:00`, and
 * a fixed offset is exactly what this setting must not hold. An offset cannot follow daylight
 * saving, so a trigger stored against one keeps summer time all winter — the fault the zone is here
 * to remove, reintroduced in the field that removes it. A named zone with no daylight saving, like
 * `America/Phoenix` or `UTC`, is fine and needs no special case: it simply has no rules to apply.
 *
 * @param zone - The candidate timezone.
 * @returns Whether a schedule may be stored against it.
 */
const isSchedulableZone = (zone: string | undefined): zone is string => {
  if (zone === undefined || zone.length === 0 || FIXED_OFFSET.test(zone)) {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: zone });

    return true;
  } catch {
    return false;
  }
};

export { isSchedulableZone };
