import * as RadixSwitch from '@radix-ui/react-switch';
import { cn } from '@FluxUI/cn';
import type { SwitchProps } from './Switch.types';

/**
 * One setting that is either on or off, and takes effect the moment it is pressed rather than
 * waiting for a form to be submitted. The label is part of the control rather than beside it, so
 * the words are a press target too.
 *
 * @param label - What the setting is.
 * @param isOn - Whether it is on now.
 * @param onToggle - Told that it was pressed; the caller decides what the new state is.
 * @param icon - Something to draw beside the label.
 * @param disabled - Whether it can be changed at all.
 * @param tone - Whether it sits on the page or over artwork, where the page's colours say nothing.
 * @param className - Extra classes for the caller's own layout.
 */
const Switch = ({
  label,
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
      className={cn(
        'flex w-full items-center gap-3 text-left outline-none',
        'focus-visible:ring-[3px] focus-visible:ring-ring/40 rounded-md',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {icon === undefined ? null : (
        <span className={cn('shrink-0', isOverlay ? 'text-white/80' : 'text-text-muted')}>
          {icon}
        </span>
      )}

      <span className="flex-1 truncate">{label}</span>

      <span
        className={cn(
          'flex h-5 w-9 shrink-0 items-center rounded-full p-0.5',
          'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]',
          'motion-reduce:transition-none',
          isOn
            ? isOverlay
              ? 'bg-white'
              : 'bg-accent'
            : isOverlay
              ? 'bg-white/25'
              : 'bg-text-muted/30',
        )}
      >
        <RadixSwitch.Thumb
          className={cn(
            'size-4 rounded-full',
            'transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)]',
            'motion-reduce:transition-none',
            isOn ? 'translate-x-4' : 'translate-x-0',
            isOn && isOverlay ? 'bg-black' : isOn ? 'bg-accent-contrast' : 'bg-white',
          )}
        />
      </span>
    </RadixSwitch.Root>
  );
};

Switch.displayName = 'Switch';

export { Switch };
