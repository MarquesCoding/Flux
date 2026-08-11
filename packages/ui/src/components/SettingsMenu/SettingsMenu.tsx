import { useState } from 'react'
import { Popover } from '@base-ui-components/react/popover'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { IconCheck, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import cnModule from '@FluxUI/cn'
import TooltipModule from '@FluxUI/Tooltip'
import type {
  SettingsChoiceRow,
  SettingsMenuProps,
  SettingsPanelRow,
  SettingsRow,
} from './SettingsMenu.types'

const { cn } = cnModule
const { Tooltip } = TooltipModule

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
 * How far a subsection slides in from.
 *
 * Enough to read as coming from the right, and not so far that the panel looks
 * like it is throwing its contents about.
 */
const SLIDE = 28

/**
 * What a row is currently set to.
 */
const answerOf = (row: SettingsRow): string | null => {
  if (row.kind === 'choice') {
    return row.choices.find((choice) => choice.id === row.selectedId)?.label ?? null
  }

  return row.kind === 'toggle' ? null : (row.detail ?? null)
}

/**
 * Whether a row leads somewhere rather than doing something in place.
 */
const opensSomething = (row: SettingsRow): row is SettingsChoiceRow | SettingsPanelRow =>
  row.kind === 'choice' || row.kind === 'panel'

/**
 * Everything about what is playing, behind one control.
 *
 * A bar with nine buttons on it asks a viewer to learn nine icons. A bar with
 * one asks them to open it and read, and reading is what somebody changing a
 * setting is doing anyway. The panel says what each thing is set to without
 * being opened item by item, so the common case — checking, not changing — is
 * a glance.
 *
 * Subsections open in place rather than beside the panel: a menu that flies
 * out sideways has nowhere to go on a phone, and a panel that replaces its own
 * contents has the same shape at every width. It slides as it does, because a
 * panel whose contents change without moving reads as a different panel rather
 * than as a step further into the same one.
 */
const SettingsMenu = ({
  label,
  trigger,
  triggerWhenOpen,
  rows,
  onOpenChange,
  isDisabled = false,
  className,
}: SettingsMenuProps) => {
  // Which row is open, if any. Held here rather than by the caller because it
  // is a thing about this panel rather than about what it describes.
  const [openId, setOpenId] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const opened =
    rows.find(
      (row): row is SettingsChoiceRow | SettingsPanelRow =>
        opensSomething(row) && row.id === openId,
    ) ?? null

  // Going in comes from the right and coming back from the left, so the
  // movement says which way the panel went rather than only that it changed.
  const travel = prefersReducedMotion === true ? 0 : SLIDE

  const close = () => {
    setOpenId(null)
  }

  return (
    <Popover.Root
      onOpenChange={(open) => {
        // Closing forgets where it was. Reopening onto the subsection somebody
        // was last in reads as the panel having got stuck.
        if (!open) {
          close()
        }

        setIsOpen(open)
        onOpenChange?.(open)
      }}
    >
      <Tooltip label={label}>
        <Popover.Trigger
          aria-label={label}
          disabled={isDisabled}
          className={cn(
            'inline-flex size-10 shrink-0 items-center justify-center rounded-full',
            'text-current transition-colors hover:bg-white/15',
            'data-[popup-open]:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          {isOpen ? (triggerWhenOpen ?? trigger) : trigger}
        </Popover.Trigger>
      </Tooltip>

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
            className="flux-glass flex w-80 flex-col overflow-hidden rounded-2xl p-2 text-white"
          >
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={opened?.id ?? 'root'}
                initial={{ opacity: 0, x: opened === null ? -travel : travel }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: opened === null ? travel : -travel }}
                transition={{ duration: prefersReducedMotion === true ? 0 : 0.18, ease: 'easeOut' }}
                className="flex max-h-[66vh] flex-col overflow-y-auto"
              >
                {opened === null
                  ? rows.map((row) => {
                      const answer = answerOf(row)

                      if (row.kind === 'toggle') {
                        return (
                          <button
                            key={row.id}
                            type="button"
                            role="switch"
                            aria-checked={row.isOn}
                            onClick={row.onToggle}
                            className={cn(ROW, 'shrink-0 hover:bg-white/10')}
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
                          <div key={row.id} className={cn(ROW, 'shrink-0 cursor-default')}>
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
                            if (row.kind === 'action') {
                              row.onSelect()

                              return
                            }

                            setOpenId(row.id)
                          }}
                          className={cn(ROW, 'shrink-0 hover:bg-white/10')}
                        >
                          <span className="shrink-0 text-white/80">{row.icon}</span>
                          <span className="shrink-0">{row.label}</span>

                          {/* The answer gives way first. A track called
                              "English · Dialogues [Forced]" would otherwise
                              push the name of the setting off its own row. */}
                          <span className="flex min-w-0 flex-1 items-center justify-end gap-1 text-white/60">
                            <span className="truncate" title={answer ?? undefined}>
                              {answer}
                            </span>
                            <IconChevronRight size={16} className="shrink-0" aria-hidden />
                          </span>
                        </button>
                      )
                    })
                  : [
                      // The way back is the heading. A panel that replaced
                      // itself and offered no way out would be a trap, and a
                      // back button beside a title is two things saying one.
                      <button
                        key="back"
                        type="button"
                        onClick={close}
                        className={cn(
                          ROW,
                          'shrink-0 border-b border-white/10 font-medium hover:bg-white/10',
                        )}
                      >
                        <IconChevronLeft size={18} aria-hidden />
                        {opened.label}
                      </button>,

                      ...(opened.kind === 'panel'
                        ? [
                            <div key="content" className="px-1 py-2">
                              {opened.content}
                            </div>,
                          ]
                        : opened.choices.map((choice) => (
                            <button
                              key={choice.id}
                              type="button"
                              role="menuitemradio"
                              aria-checked={choice.id === opened.selectedId}
                              onClick={() => {
                                opened.onSelect(choice.id)
                                close()
                              }}
                              className={cn(ROW, 'shrink-0 hover:bg-white/10')}
                            >
                              <span className="flex size-4 shrink-0 items-center justify-center">
                                {choice.id === opened.selectedId ? (
                                  <IconCheck size={16} stroke={3} aria-hidden />
                                ) : null}
                              </span>

                              <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate">{choice.label}</span>
                                {choice.detail === undefined ? null : (
                                  <span className="truncate text-xs text-white/60">
                                    {choice.detail}
                                  </span>
                                )}
                              </span>
                            </button>
                          ))),
                    ]}
              </motion.div>
            </AnimatePresence>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

SettingsMenu.displayName = 'SettingsMenu'

export default { SettingsMenu }
