import { IconX } from '@tabler/icons-react'
import IconButtonModule from '@FluxUI/IconButton'
import ButtonModule from '@FluxUI/Button'
import SliderModule from '@FluxUI/Slider'
import OptionMenuModule from '@FluxUI/OptionMenu'
import captionStyleModule from '@FluxWeb/playback/captionStyle'
import type { CaptionSettingsProps } from './CaptionSettings.types'

const { IconButton } = IconButtonModule
const { Button } = ButtonModule
const { Slider } = SliderModule
const { OptionMenu } = OptionMenuModule
const { toCueDeclarations } = captionStyleModule

const FONTS = [
  { id: 'sans', label: 'Sans serif' },
  { id: 'serif', label: 'Serif' },
  { id: 'mono', label: 'Monospace' },
  { id: 'casual', label: 'Casual' },
] as const

const EDGES = [
  { id: 'none', label: 'None' },
  { id: 'outline', label: 'Outline' },
  { id: 'shadow', label: 'Drop shadow' },
  { id: 'raised', label: 'Raised' },
] as const

const COLOURS = [
  { id: '#ffffff', label: 'White' },
  { id: '#ffff00', label: 'Yellow' },
  { id: '#00ff00', label: 'Green' },
  { id: '#00ffff', label: 'Cyan' },
  { id: '#ff0000', label: 'Red' },
  { id: '#000000', label: 'Black' },
] as const

const nameOf = (options: readonly { id: string; label: string }[], id: string): string =>
  options.find((option) => option.id === id)?.label ?? id

/**
 * How captions should look, decided by the person reading them.
 *
 * Every setting here exists because the right answer depends on the room: a
 * television across a lounge wants large text with a solid background, a
 * laptop at arm's length wants neither. The preview is styled with the same
 * CSS the cues get, so what is chosen here is what appears on the film.
 */
const CaptionSettings = ({ style, onChange, onReset, onClose }: CaptionSettingsProps) => (
  <section
    aria-label="Caption settings"
    className="pointer-events-auto flex max-h-full w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-xl bg-black/80 p-4 text-sm text-white backdrop-blur-md"
  >
    <header className="flex items-center justify-between gap-4">
      <h3 className="text-base font-medium">Captions</h3>

      <IconButton label="Close caption settings" size="sm" onClick={onClose}>
        <IconX size={16} aria-hidden />
      </IconButton>
    </header>

    <p
      aria-label="Caption preview"
      className="rounded-md px-3 py-2 text-center"
      style={toCueDeclarations(style)}
    >
      The quick brown fox
    </p>

    <div className="flex items-center justify-between gap-3">
      <span>Font</span>

      <OptionMenu
        label="Caption font"
        trigger={<span className="text-xs">{nameOf(FONTS, style.fontFamily)}</span>}
        className="w-auto px-3"
        groups={[
          {
            name: 'Font',
            selectedId: style.fontFamily,
            onSelect: (id) => {
              onChange({ ...style, fontFamily: FONTS.find((font) => font.id === id)?.id ?? 'sans' })
            },
            options: FONTS.map((font) => ({ id: font.id, label: font.label })),
          },
        ]}
      />
    </div>

    <label className="flex flex-col gap-1">
      <span>Size — {style.fontScale}%</span>

      <Slider
        label="Caption size"
        tone="overlay"
        value={style.fontScale}
        max={300}
        step={10}
        onValueChange={(value) => {
          onChange({ ...style, fontScale: Math.max(50, value) })
        }}
      />
    </label>

    <div className="flex items-center justify-between gap-3">
      <span>Colour</span>

      <OptionMenu
        label="Caption colour"
        trigger={<span className="text-xs">{nameOf(COLOURS, style.color)}</span>}
        className="w-auto px-3"
        groups={[
          {
            name: 'Text',
            selectedId: style.color,
            onSelect: (id) => {
              onChange({ ...style, color: id })
            },
            options: COLOURS.map((colour) => ({ id: colour.id, label: colour.label })),
          },
          {
            name: 'Background',
            selectedId: style.backgroundColor,
            onSelect: (id) => {
              onChange({ ...style, backgroundColor: id })
            },
            options: COLOURS.map((colour) => ({ id: colour.id, label: colour.label })),
          },
        ]}
      />
    </div>

    <label className="flex flex-col gap-1">
      <span>Background opacity — {Math.round(style.backgroundOpacity * 100)}%</span>

      <Slider
        label="Caption background opacity"
        tone="overlay"
        value={Math.round(style.backgroundOpacity * 100)}
        max={100}
        step={5}
        onValueChange={(value) => {
          onChange({ ...style, backgroundOpacity: value / 100 })
        }}
      />
    </label>

    <div className="flex items-center justify-between gap-3">
      <span>Edge</span>

      <OptionMenu
        label="Caption edge"
        trigger={<span className="text-xs">{nameOf(EDGES, style.edgeStyle)}</span>}
        className="w-auto px-3"
        groups={[
          {
            name: 'Edge',
            selectedId: style.edgeStyle,
            onSelect: (id) => {
              onChange({
                ...style,
                edgeStyle: EDGES.find((edge) => edge.id === id)?.id ?? 'outline',
              })
            },
            options: EDGES.map((edge) => ({ id: edge.id, label: edge.label })),
          },
        ]}
      />
    </div>

    <Button variant="secondary" size="sm" onClick={onReset}>
      Reset to defaults
    </Button>
  </section>
)

CaptionSettings.displayName = 'CaptionSettings'

export default { CaptionSettings }
