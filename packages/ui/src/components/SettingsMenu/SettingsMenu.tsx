import { useState } from 'react'
import { Popover } from '@base-ui-components/react/popover'
import { IconCheck, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import cnModule from '@FluxUI/cn'
import type { SettingsChoiceRow, SettingsMenuProps, SettingsRow } from './SettingsMenu.types'

const { cn } = cnModule

/**
 * The class every row shares.
 *
 * One line, an icon, a name on the left and the answer on the right. A panel
 * where each row is laid out slightly differently is a panel that reads as a
 * list of unrelated things.
 */
const ROW =
  'flex w-full items-center gap-4 rounded-lg px-3 py-2.5 text-left text-sm transition-colors'

/**
 * What a row is currently set to.
 */
const answerOf = (row: SettingsRow): string | null => {
  if (row.kind === 'choice') {
    return row.choices.find((choice) => choice.id === row.selectedId)?.label ?? null
  }

  return row.kind === 'action' || row.kind === 'custom' ? (row.detail ?? null) : null
}

/**
 * Everything about what is playing, behind one control.
 *
 * A bar with nine buttons on it asks a viewer to learn nine icons. A bar with
 * one asks them to open it and read, and reading is what somebody changing a
 * setting is doing anyway. The panel says what each thing is set to without
 * being opened item by item, so the common case — checking, not changing — is
 * a glance.
 *
 * Choices open in place rather than in a menu beside the panel: a submenu that
 * flies out sideways has nowhere to go on a phone, and a panel that replaces
 * its own contents has the same shape at every width.
 */
const SettingsMenu = ({
  label,
  trigger,
  rows,
  isDisabled = false,
  className,
}: SettingsMenuProps) => {
  // Which row's choices are open, if any. Held here rather than by the caller
  // because it is a thing about this panel rather than about the film.
  const [openId, setOpenId] = useState<string | null>(null)

  const opened =
    rows.find((row): row is SettingsChoiceRow => row.kind === 'choice' && row.id === openId) ?? null

  return (
    <Popover.Root
      onOpenChange={(isOpen) => {
        // Closing forgets where it was. Reopening onto the list somebody was
        // last in reads as the panel having got stuck.
        if (!isOpen) {
          setOpenId(null)
        }
      }}
    >
      <Popover.Trigger
        aria-label={label}
        title={label}
        disabled={isDisabled}
        className={cn(
          'inline-flex size-10 shrink-0 items-center justify-center rounded-full',
          'text-current transition-colors hover:bg-white/15',
          'data-[popup-open]:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        {trigger}
      </Popover.Trigger>

      <Popover.Portal>
        {/* Above the bar and pinned to its own button, with room kept at the
            edges: a panel that opens past the side of the window is a panel
            with half its answers off screen. */}
        <Popover.Positioner
          side="top"
          sideOffset={12}
          align="end"
          collisionPadding={12}
          className="z-50"
        >
          <Popover.Popup
            aria-label={label}
            // The same glass as the bar it belongs to, rather than a dark
            // rectangle sitting on top of one.
            className="flux-glass flex max-h-[70vh] w-80 flex-col overflow-y-auto rounded-2xl p-2 text-white"
          >
            {opened === null ? (
              rows.map((row) => {
                const answer = answerOf(row)

                if (row.kind === 'toggle') {
                  return (
                    <button
                      key={row.id}
                      type="button"
                      role="switch"
                      aria-checked={row.isOn}
                      onClick={row.onToggle}
                      className={cn(ROW, 'hover:bg-white/10')}
                    >
                      <span className="shrink-0 text-white/80">{row.icon}</span>
                      <span className="flex-1 truncate">{row.label}</span>

                      <span
                        className={cn(
                          'flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
                          row.isOn ? 'bg-white' : 'bg-white/25',
                        )}
                      >
                        <span
                          className={cn(
                            'size-4 rounded-full transition-transform',
                            row.isOn ? 'translate-x-4 bg-black' : 'bg-white',
                          )}
                        />
                      </span>
                    </button>
                  )
                }

                if (row.kind === 'custom') {
                  return (
                    <div key={row.id} className={cn(ROW, 'cursor-default')}>
                      <span className="shrink-0 text-white/80">{row.icon}</span>

                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{row.label}</span>
                        {answer === null ? null : (
                          <span className="truncate text-xs text-white/60">{answer}</span>
                        )}
                      </span>

                      {row.control}
                    </div>
                  )
                }

                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => {
                      if (row.kind === 'choice') {
                        setOpenId(row.id)

                        return
                      }

                      row.onSelect()
                    }}
                    className={cn(ROW, 'hover:bg-white/10')}
                  >
                    <span className="shrink-0 text-white/80">{row.icon}</span>
                    <span className="shrink-0">{row.label}</span>

                    {/* The answer gives way first. A track called "English ·
                        Dialogues [Forced]" would otherwise push the name of
                        the setting off its own row. */}
                    <span className="flex min-w-0 flex-1 items-center justify-end gap-1 text-white/60">
                      <span className="truncate" title={answer ?? undefined}>
                        {answer}
                      </span>
                      <IconChevronRight size={16} className="shrink-0" aria-hidden />
                    </span>
                  </button>
                )
              })
            ) : (
              <>
                {/* The way back is the heading. A panel that replaced itself
                    and offered no way out would be a trap, and a separate back
                    button beside a title is two things saying one. */}
                <button
                  type="button"
                  onClick={() => {
                    setOpenId(null)
                  }}
                  className={cn(ROW, 'border-b border-white/10 font-medium hover:bg-white/10')}
                >
                  <IconChevronLeft size={18} aria-hidden />
                  {opened.label}
                </button>

                {opened.choices.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    aria-checked={choice.id === opened.selectedId}
                    role="menuitemradio"
                    onClick={() => {
                      opened.onSelect(choice.id)
                      setOpenId(null)
                    }}
                    className={cn(ROW, 'hover:bg-white/10')}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      {choice.id === opened.selectedId ? (
                        <IconCheck size={16} stroke={3} aria-hidden />
                      ) : null}
                    </span>

                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{choice.label}</span>
                      {choice.detail === undefined ? null : (
                        <span className="truncate text-xs text-white/60">{choice.detail}</span>
                      )}
                    </span>
                  </button>
                ))}
              </>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

SettingsMenu.displayName = 'SettingsMenu'

export default { SettingsMenu }
