import { Switch as BaseSwitch } from '@base-ui/react/switch';
import { cn } from '@FluxUI/cn';
import type { SwitchProps } from './Switch.types';

/**
 * One setting that is either on or off, and takes effect the moment it is pressed rather than
 * waiting for a form to be submitted. The label is part of the control rather than beside it, so the
 * words are a press target too.
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
    <BaseSwitch.Root
      checked={isOn}
      disabled={disabled}
      onCheckedChange={onToggle}
      className={cn(
        'flex w-full items-center gap-3 text-left',
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
          'flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
          isOn
            ? isOverlay
              ? 'bg-white'
              : 'bg-accent'
            : isOverlay
              ? 'bg-white/25'
              : 'bg-text-muted/30',
        )}
      >
        <BaseSwitch.Thumb
          className={cn(
            'size-4 rounded-full transition-transform',
            isOn ? 'translate-x-4' : 'translate-x-0',
            isOn && isOverlay ? 'bg-black' : isOn ? 'bg-accent-contrast' : 'bg-white',
          )}
        />
      </span>
    </BaseSwitch.Root>
  );
};

Switch.displayName = 'Switch';

export { Switch };
