import { Menu } from '@base-ui-components/react/menu'
import { IconCheck } from '@tabler/icons-react'
import cnModule from '@FluxUI/cn'
import type { OptionMenuProps } from './OptionMenu.types'

const { cn } = cnModule

/**
 * A menu of mutually exclusive choices, in one or more columns.
 *
 * Built on the Base UI menu so focus handling, escape, outside clicks and the
 * radio semantics come from a primitive that already gets them right. Every
 * column is a radio group, because these are settings rather than commands.
 */
const OptionMenu = ({ label, trigger, groups, isDisabled = false, className }: OptionMenuProps) => (
  <Menu.Root>
    <Menu.Trigger
      aria-label={label}
      title={label}
      disabled={isDisabled}
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-full',
        'text-current transition-colors hover:bg-white/15',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'data-[popup-open]:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {trigger}
    </Menu.Trigger>

    <Menu.Portal>
      <Menu.Positioner sideOffset={8} align="end" className="z-50">
        <Menu.Popup
          aria-label={label}
          className="flex max-h-80 overflow-hidden rounded-xl bg-neutral-900/95 text-sm text-white shadow-xl backdrop-blur-md"
        >
          {groups.map((group) => (
            <Menu.Group
              key={group.name}
              className="flex min-w-44 flex-col overflow-y-auto border-l border-white/10 first:border-l-0"
            >
              <Menu.GroupLabel className="px-4 py-3 text-base font-medium">
                {group.name}
              </Menu.GroupLabel>

              <Menu.RadioGroup
                value={group.selectedId}
                onValueChange={(next) => {
                  group.onSelect(String(next))
                }}
                className="flex flex-col"
              >
                {group.options.map((option) => (
                  <Menu.RadioItem
                    key={option.id}
                    value={option.id}
                    className={cn(
                      'flex cursor-default items-center justify-between gap-4 px-4 py-2.5',
                      'outline-none data-[highlighted]:bg-white/10 data-[checked]:bg-white/5',
                    )}
                  >
                    <span className="flex flex-col">
                      {option.label}
                      {option.detail === undefined ? null : (
                        <span className="text-xs text-white/50">{option.detail}</span>
                      )}
                    </span>

                    <Menu.RadioItemIndicator className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-black">
                      <IconCheck size={14} stroke={3} aria-hidden />
                    </Menu.RadioItemIndicator>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Group>
          ))}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
)

OptionMenu.displayName = 'OptionMenu'

export default { OptionMenu }
