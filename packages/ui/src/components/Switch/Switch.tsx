import { Switch as BaseSwitch } from '@base-ui/react/switch';
import { cn } from '@FluxUI/cn';
import type { SwitchProps } from './Switch.types';

/**
 * One setting that is either on or off.
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
