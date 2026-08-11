import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SettingsMenu } from './SettingsMenu'
import type { SettingsRow } from './SettingsMenu.types'

const SPEED: SettingsRow = {
  kind: 'choice',
  id: 'speed',
  label: 'Playback speed',
  icon: <span aria-hidden>·</span>,
  selectedId: '1',
  onSelect: vi.fn(),
  choices: [
    { id: '0.5', label: '0.5x' },
    { id: '1', label: 'Normal' },
  ],
}

const draw = (rows: SettingsRow[] = [SPEED], props: { onOpenChange?: () => void } = {}) =>
  render(<SettingsMenu label="Settings" trigger={<span>gear</span>} rows={rows} {...props} />)

const open = async (actor: ReturnType<typeof userEvent.setup>) => {
  await actor.click(screen.getByRole('button', { name: 'Settings' }))
}

describe('SettingsMenu', () => {
  it('keeps everything behind one control', () => {
    draw()

    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.queryByText('Playback speed')).not.toBeInTheDocument()
  })

  it('says what each thing is set to without being opened item by item', async () => {
    const actor = userEvent.setup()

    draw()
    await open(actor)

    expect(
      await screen.findByRole('button', { name: /Playback speed.*Normal/ }),
    ).toBeInTheDocument()
  })

  it('opens a list in place rather than beside itself', async () => {
    const actor = userEvent.setup()

    draw()
    await open(actor)
    await actor.click(await screen.findByRole('button', { name: /Playback speed/ }))

    expect(await screen.findByRole('menuitemradio', { name: '0.5x' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Playback speed.*Normal/ })).not.toBeInTheDocument()
  })

  it('marks what is already chosen', async () => {
    const actor = userEvent.setup()

    draw()
    await open(actor)
    await actor.click(await screen.findByRole('button', { name: /Playback speed/ }))

    expect(await screen.findByRole('menuitemradio', { name: 'Normal' })).toBeChecked()
  })

  it('reports a choice and comes back to the panel', async () => {
    const onSelect = vi.fn()
    const actor = userEvent.setup()

    draw([{ ...SPEED, onSelect }])
    await open(actor)
    await actor.click(await screen.findByRole('button', { name: /Playback speed/ }))
    await actor.click(await screen.findByRole('menuitemradio', { name: '0.5x' }))

    expect(onSelect).toHaveBeenCalledWith('0.5')
    expect(await screen.findByRole('button', { name: /Playback speed/ })).toBeInTheDocument()
  })

  it('offers the way back as the heading, rather than as a second thing to find', async () => {
    const actor = userEvent.setup()

    draw()
    await open(actor)
    await actor.click(await screen.findByRole('button', { name: /Playback speed/ }))
    await actor.click(await screen.findByRole('button', { name: 'Playback speed' }))

    expect(
      await screen.findByRole('button', { name: /Playback speed.*Normal/ }),
    ).toBeInTheDocument()
  })

  it('draws a switch for something that is on or off', async () => {
    const onToggle = vi.fn()
    const actor = userEvent.setup()

    draw([
      {
        kind: 'toggle',
        id: 'stats',
        label: 'Stats for nerds',
        icon: <span aria-hidden>·</span>,
        isOn: true,
        onToggle,
      },
    ])
    await open(actor)
    await actor.click(await screen.findByRole('switch', { name: /Stats for nerds/ }))

    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('says which way a switch is set', async () => {
    const actor = userEvent.setup()

    draw([
      {
        kind: 'toggle',
        id: 'stats',
        label: 'Stats for nerds',
        icon: <span aria-hidden>·</span>,
        isOn: true,
        onToggle: vi.fn(),
      },
    ])
    await open(actor)

    expect(await screen.findByRole('switch', { name: /Stats for nerds/ })).toBeChecked()
  })

  it('does something at once for a row that does something', async () => {
    const onSelect = vi.fn()
    const actor = userEvent.setup()

    draw([
      {
        kind: 'action',
        id: 'reset',
        label: 'Reset',
        icon: <span aria-hidden>·</span>,
        onSelect,
      },
    ])
    await open(actor)
    await actor.click(await screen.findByRole('button', { name: /Reset/ }))

    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('holds a control of its own for what is adjusted by feel', async () => {
    const actor = userEvent.setup()

    draw([
      {
        kind: 'custom',
        id: 'timing',
        label: 'Subtitle timing',
        icon: <span aria-hidden>·</span>,
        detail: 'In time',
        control: <button type="button">Later</button>,
      },
    ])
    await open(actor)

    expect(await screen.findByRole('button', { name: 'Later' })).toBeInTheDocument()
    expect(screen.getByText('In time')).toBeInTheDocument()
  })

  it('gives a page of its own to something too big for a list', async () => {
    const actor = userEvent.setup()

    draw([
      {
        kind: 'panel',
        id: 'captions',
        label: 'Caption settings',
        icon: <span aria-hidden>·</span>,
        content: <p>A dozen controls</p>,
      },
    ])
    await open(actor)
    await actor.click(await screen.findByRole('button', { name: /Caption settings/ }))

    expect(await screen.findByText('A dozen controls')).toBeInTheDocument()
  })

  it('says when it opens, so a bar underneath can stay up', async () => {
    const onOpenChange = vi.fn()
    const actor = userEvent.setup()

    draw([SPEED], { onOpenChange })
    await open(actor)

    expect(onOpenChange.mock.calls.at(-1)?.[0]).toBe(true)
  })

  it('opens nothing while it is disabled', async () => {
    const actor = userEvent.setup()

    render(<SettingsMenu label="Settings" trigger={<span>gear</span>} rows={[SPEED]} isDisabled />)
    await open(actor)

    expect(screen.queryByText('Playback speed')).not.toBeInTheDocument()
  })

  it('sets a display name so devtools can identify it', () => {
    expect(SettingsMenu.displayName).toBe('SettingsMenu')
  })
})
