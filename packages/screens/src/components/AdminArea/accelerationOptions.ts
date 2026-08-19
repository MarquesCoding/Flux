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
