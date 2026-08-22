import { isSchedulableZone } from './isSchedulableZone';

const FALLBACK = 'UTC';

type ResolveJobsTimezoneOptions = {
  configured: string;
  environment: string | undefined;
  host: string | undefined;
};

/**
 * Decides which clock a scheduled job keeps.
 *
 * Three sources in order of how deliberately they were chosen. What an operator set in the settings
 * wins, because it is the only one they picked on purpose. `TZ` comes next: it is how a container is
 * told where it lives, and Valence's image sets none, so a container reports `UTC` however far from it
 * the operator actually is. The host's own zone is right for a native install and is the last
 * source rather than the first for that reason.
 *
 * Falls back to UTC, which is what pg-boss would have assumed anyway — so an unresolvable setting
 * leaves behaviour exactly as it was rather than failing to schedule.
 *
 * @param options - The configured setting, the environment's `TZ`, and the host's own zone.
 * @returns The timezone every cron trigger is interpreted in.
 */
const resolveJobsTimezone = ({
  configured,
  environment,
  host,
}: ResolveJobsTimezoneOptions): string =>
  [configured, environment, host].find(isSchedulableZone) ?? FALLBACK;

export type { ResolveJobsTimezoneOptions };

export { resolveJobsTimezone, FALLBACK };
