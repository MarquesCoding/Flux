import { useEffect, useRef, useState } from 'react';
import { ArrowLeft02Icon, PauseIcon, PlayIcon } from '@hugeicons/core-free-icons';
import { Button } from '@ValenceUI/Button';
import { Icon } from '@ValenceUI/Icon';
import { Slider } from '@ValenceUI/Slider';
import { Spinner } from '@ValenceUI/Spinner';
import { VideoSurface } from '@ValenceUI/VideoSurface';
import { formatDuration } from '@ValenceCore/functions/formatDuration';
import { sourceForAFile } from '@ValenceClient/downloads/keepingFiles';
import type { OfflinePlayerProps } from './OfflinePlayer.types';

/**
 * Plays a file that is already on this machine.
 *
 * Almost nothing happens here, and that is the point. There is no session to negotiate, no playlist
 * to assemble, no rendition to choose and nothing to transcode — the file on the disk is already
 * exactly what was asked for when it was downloaded, so it is named and played. Everything the
 * ordinary player does that this does not is work that only exists because a server is involved.
 *
 * The length is taken from the file rather than from what was recorded about it. A transfer that was
 * interrupted leaves a shorter film than the catalogue describes, and a scrubber built on the
 * catalogue's figure would let somebody drag past the end of what they actually have.
 *
 * @param file - What is being played.
 * @param startAtSeconds - Where to pick up, where somebody has watched some of it already.
 * @param onLeave - Told to go back to the shelf.
 * @param onProgress - Told where they got to, so it can be reconciled when the server is back.
 */
const OfflinePlayer = ({ file, startAtSeconds = 0, onLeave, onProgress }: OfflinePlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [position, setPosition] = useState(startAtSeconds);
  const [duration, setDuration] = useState(file.durationSeconds ?? 0);

  useEffect(() => {
    const element = videoRef.current;

    if (element !== null && startAtSeconds > 0) {
      element.currentTime = startAtSeconds;
    }
  }, [startAtSeconds]);

  return (
    <main className="flex h-full min-h-screen flex-col bg-shade">
      <header className="flex items-center gap-3 px-4 py-3">
        <Button variant="ghost" size="sm" isIconOnly label="Back to downloads" onClick={onLeave}>
          <Icon of={ArrowLeft02Icon} size={18} />
        </Button>

        <div className="flex min-w-0 flex-col">
          <h1 className="truncate font-body text-sm text-text">{file.title}</h1>

          {file.seriesTitle === null ? null : (
            <p className="truncate font-body text-xs text-text-muted">{file.seriesTitle}</p>
          )}
        </div>
      </header>

      <div className="relative flex flex-1 items-center justify-center">
        <VideoSurface
          label={file.title}
          src={sourceForAFile(file.downloadId)}
          videoRef={videoRef}
          className="max-h-[80vh] w-full"
          onTimeUpdate={(seconds) => {
            setPosition(seconds);
            onProgress?.(seconds, duration);
          }}
          onDurationChange={setDuration}
          onPlayingChange={setIsPlaying}
          onBufferingChange={setIsBuffering}
        />

        {!isBuffering ? null : (
          <span className="pointer-events-none absolute">
            <Spinner size="lg" label={`Waiting for ${file.title}`} />
          </span>
        )}
      </div>

      <footer className="flex items-center gap-4 px-4 py-4">
        <Button
          variant="soft"
          size="sm"
          isIconOnly
          label={isPlaying ? `Pause ${file.title}` : `Play ${file.title}`}
          onClick={() => {
            const element = videoRef.current;

            if (element === null) {
              return;
            }

            if (element.paused) {
              void element.play();

              return;
            }

            element.pause();
          }}
        >
          <Icon of={isPlaying ? PauseIcon : PlayIcon} size={18} />
        </Button>

        <span className="font-body text-xs tabular-nums text-text-muted">
          {formatDuration(position)}
        </span>

        <Slider
          value={position}
          max={duration > 0 ? duration : 1}
          label={`Scrub through ${file.title}`}
          className="flex-1"
          onValueChange={(seconds) => {
            const element = videoRef.current;

            setPosition(seconds);

            if (element !== null) {
              element.currentTime = seconds;
            }
          }}
        />

        <span className="font-body text-xs tabular-nums text-text-muted">
          {formatDuration(duration)}
        </span>
      </footer>
    </main>
  );
};

OfflinePlayer.displayName = 'OfflinePlayer';

export { OfflinePlayer };
