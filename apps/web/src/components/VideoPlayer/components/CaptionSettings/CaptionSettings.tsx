import { Button } from '@FluxUI/Button';
import { Slider } from '@FluxUI/Slider';
import { CaptionChoice } from './components/CaptionChoice/CaptionChoice';
import { toCueDeclarations } from '@FluxWeb/playback/captionStyle';
import type { CaptionSettingsProps } from './CaptionSettings.types';

const FONTS = [
  { id: 'sans', label: 'Sans serif' },
  { id: 'serif', label: 'Serif' },
  { id: 'mono', label: 'Monospace' },
  { id: 'casual', label: 'Casual' },
] as const;

const EDGES = [
  { id: 'none', label: 'None' },
  { id: 'outline', label: 'Outline' },
  { id: 'shadow', label: 'Drop shadow' },
  { id: 'raised', label: 'Raised' },
] as const;

const COLOURS = [
  { id: '#ffffff', label: 'White' },
  { id: '#ffff00', label: 'Yellow' },
  { id: '#00ff00', label: 'Green' },
  { id: '#00ffff', label: 'Cyan' },
  { id: '#ff0000', label: 'Red' },
  { id: '#000000', label: 'Black' },
] as const;

/**
 * How captions should look, decided by the person reading them.
 */
const CaptionSettings = ({ style, onChange, onReset }: CaptionSettingsProps) => (
  <section aria-label="Caption settings" className="flex w-full flex-col gap-4 text-sm text-white">
    <p
      aria-label="Caption preview"
      className="rounded-md px-3 py-2 text-center"
      style={toCueDeclarations(style)}
    >
      The quick brown fox
    </p>

    <CaptionChoice
      label="Font"
      options={FONTS}
      selectedId={style.fontFamily}
      onSelect={(id) => {
        onChange({ ...style, fontFamily: FONTS.find((font) => font.id === id)?.id ?? 'sans' });
      }}
    />

    <div className="flex flex-col gap-1">
      <span>Size — {style.fontScale}%</span>

      <Slider
        label="Caption size"
        tone="overlay"
        value={style.fontScale}
        max={300}
        step={10}
        onValueChange={(value) => {
          onChange({ ...style, fontScale: Math.max(50, value) });
        }}
      />
    </div>

    <CaptionChoice
      label="Text colour"
      options={COLOURS}
      selectedId={style.color}
      onSelect={(id) => {
        onChange({ ...style, color: id });
      }}
    />

    <CaptionChoice
      label="Background colour"
      options={COLOURS}
      selectedId={style.backgroundColor}
      onSelect={(id) => {
        onChange({ ...style, backgroundColor: id });
      }}
    />

    <div className="flex flex-col gap-1">
      <span>Background opacity — {Math.round(style.backgroundOpacity * 100)}%</span>

      <Slider
        label="Caption background opacity"
        tone="overlay"
        value={Math.round(style.backgroundOpacity * 100)}
        max={100}
        step={5}
        onValueChange={(value) => {
          onChange({ ...style, backgroundOpacity: value / 100 });
        }}
      />
    </div>

    <CaptionChoice
      label="Edge"
      options={EDGES}
      selectedId={style.edgeStyle}
      onSelect={(id) => {
        onChange({ ...style, edgeStyle: EDGES.find((edge) => edge.id === id)?.id ?? 'outline' });
      }}
    />

    <Button variant="secondary" size="sm" onClick={onReset}>
      Reset to defaults
    </Button>
  </section>
);

CaptionSettings.displayName = 'CaptionSettings';

export { CaptionSettings };
