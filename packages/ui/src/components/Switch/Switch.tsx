import * as RadixSwitch from '@radix-ui/react-switch';
import { cn } from '@ValenceUI/cn';
import type { SwitchProps } from './Switch.types';

/**
 * One setting that is either on or off, and takes effect the moment it is pressed rather than
 * waiting for a form to be submitted. The label is part of the control rather than beside it, so
 * the words are a press target too.
 *
 * @param label - What the setting is.
 * @param isLabelHidden - Whether to draw only the switch, for a row that already says what it is.
 * @param isOn - Whether it is on now.
 * @param onToggle - Told that it was pressed; the caller decides what the new state is.
 * @param icon - Something to draw beside the label.
 * @param disabled - Whether it can be changed at all.
 * @param tone - Whether it sits on the page or over artwork, where the page's colours say nothing.
 * @param className - Extra classes for the caller's own layout.
 */
const Switch = ({
  label,
  isLabelHidden = false,
  isOn,
  onToggle,
  icon,
  disabled = false,
  tone = 'default',
  className,
}: SwitchProps) => {
  const isOverlay = tone === 'overlay';

  return (
    <RadixSwitch.Root
      checked={isOn}
      disabled={disabled}
      onCheckedChange={onToggle}
      data-slot="switch"
      {...(isLabelHidden ? { 'aria-label': label } : {})}
      className={cn(
        isLabelHidden
          ? 'flex items-center outline-none'
          : 'flex w-full items-center gap-3 text-left outline-none',
        'focus-visible:ring-[3px] focus-visible:ring-ring rounded-md',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {icon === undefined ? null : (
        <span className={cn('shrink-0', isOverlay ? 'text-white/80' : 'text-text-muted')}>
          {icon}
        </span>
      )}

      {isLabelHidden ? null : <span className="flex-1 truncate">{label}</span>}

      <span
        className={cn(
          'flex h-[26px] w-14 shrink-0 items-center rounded-pill p-[3px]',
          'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]',
          'motion-reduce:transition-none',
          isOn
            ? isOverlay
              ? 'bg-white'
              : 'bg-accent'
            : isOverlay
              ? 'bg-white/25'
              : 'bg-text-muted/25',
        )}
      >
        <RadixSwitch.Thumb
          className={cn(
            'h-5 w-8 shrink-0 rounded-pill shadow-sm',
            'transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)]',
            'motion-reduce:transition-none',
            isOn ? 'translate-x-[18px]' : 'translate-x-0',
            isOn && isOverlay ? 'bg-black' : isOn ? 'bg-white' : 'bg-white',
          )}
        />
      </span>
    </RadixSwitch.Root>
  );
};

Switch.displayName = 'Switch';

export { Switch };
