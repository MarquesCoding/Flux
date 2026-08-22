import { cn } from '@ValenceUI/cn';
import type { SettingListProps } from './SettingList.types';

/**
 * Stacks settings with a hairline between them and nothing around them, so a panel of settings
 * reads as one continuous thing rather than a column of separate cards. The line is drawn between
 * rows rather than under each one, which is why this exists instead of each row carrying its own
 * border and the last one having to take it off again.
 *
 * @param children - The rows.
 * @param className - Extra classes for the caller's own layout.
 */
const SettingList = ({ children, className }: SettingListProps) => (
  <div
    data-slot="setting-list"
    className={cn(
      'flex flex-col divide-y divide-[var(--surface-line)]',
      '[&>[data-marked]]:border-transparent',
      className,
    )}
  >
    {children}
  </div>
);

SettingList.displayName = 'SettingList';

export { SettingList };
