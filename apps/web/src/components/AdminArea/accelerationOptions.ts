/**
 * The hardware acceleration backends an operator can insist on.
 *
 * Only backends Flux can actually plan a pipeline for, so nothing here can be
 * chosen and then quietly ignored. Automatic is first because it is right
 * almost always.
 *
 * Shared rather than owned by the settings panel, because the badge that
 * reports what is in force has to say the same words as the menu that chose
 * it. Two lists would drift, and the drift would read as a bug in whichever
 * one somebody looked at second.
 */
const accelerationOptions = [
  { id: '', label: 'Automatic', detail: 'Use whichever the machine proves it can do' },
  { id: 'vaapi', label: 'VAAPI', detail: 'Intel and AMD on Linux' },
  { id: 'qsv', label: 'QuickSync', detail: 'Intel' },
  { id: 'nvenc', label: 'NVENC', detail: 'NVIDIA' },
  { id: 'amf', label: 'AMF', detail: 'AMD, needs the proprietary driver' },
  { id: 'videotoolbox', label: 'VideoToolbox', detail: 'Apple' },
  { id: 'rkmpp', label: 'RKMPP', detail: 'Rockchip' },
  { id: 'none', label: 'Software only', detail: 'Never use the hardware' },
];

export { accelerationOptions };
