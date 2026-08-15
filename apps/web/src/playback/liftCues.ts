const liftCues = (
  element: HTMLVideoElement,
  lineAt: () => number,
): { stop: () => void; apply: () => void } => {
  const lift = (isRedrawNeeded = false) => {
    const line = lineAt();

    for (const track of Array.from(element.textTracks)) {
      let hasMoved = false;

      for (const cue of Array.from(track.cues ?? [])) {
        if ('line' in cue && 'snapToLines' in cue) {
          cue.snapToLines = false;
          cue.line = line;
          hasMoved = true;
        }
      }

      if (isRedrawNeeded && hasMoved && track.mode === 'showing') {
        track.mode = 'hidden';
        track.mode = 'showing';
      }
    }
  };

  const onCueChange = () => {
    lift();
  };

  const watch = () => {
    lift();

    for (const track of Array.from(element.textTracks)) {
      track.addEventListener('cuechange', onCueChange);
    }
  };

  watch();
  element.textTracks.addEventListener('addtrack', watch);

  return {
    apply: () => {
      lift(true);
    },
    stop: () => {
      element.textTracks.removeEventListener('addtrack', watch);

      for (const track of Array.from(element.textTracks)) {
        track.removeEventListener('cuechange', onCueChange);
      }
    },
  };
};

const CUE_LINE_CLEAR = 92;

const CUE_LINE_ABOVE_CONTROLS = 80;

export { liftCues, CUE_LINE_CLEAR, CUE_LINE_ABOVE_CONTROLS };
