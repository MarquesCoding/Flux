import { useEffect, useState } from 'react';
import { cn } from '@FluxUI/cn';
import { profileInitial, profileAvatarUrl } from '@FluxContracts/schemas/ViewerProfile';
import type { ProfileFaceProps } from './ProfileFace.types';

/**
 * What a profile looks like.
 *
 * One component because four screens draw the same thing — the wall, the
 * picker, the editor and the account page — and a face that means something
 * different in each of them is four faces.
 *
 * A moving picture needs an element that can play it. A GIF is still a
 * picture as far as a browser is concerned, but a WebM in an image tag shows
 * nothing at all, which is exactly the sort of blank square somebody would
 * assume was a failed upload.
 */
const ProfileFace = ({ profile, pending = null, className }: ProfileFaceProps) => {
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    if (pending === null) {
      setChosen(null);

      return;
    }

    const address = URL.createObjectURL(pending);

    setChosen(address);

    return () => {
      URL.revokeObjectURL(address);
    };
  }, [pending]);

  const isMoving =
    chosen === null
      ? profile.avatar.kind === 'photo' && profile.avatar.isVideo
      : pending?.type.startsWith('video/') === true;
  const source = chosen ?? profileAvatarUrl(profile);
  const showsPicture = chosen !== null || profile.avatar.kind !== 'initial';

  return (
    <span
      style={{ backgroundColor: showsPicture ? undefined : profile.colour }}
      className={cn(
        'flex items-center justify-center overflow-hidden bg-white/5 font-semibold text-black/80',
        className,
      )}
    >
      {!showsPicture ? (
        profileInitial(profile.name)
      ) : isMoving ? (
        <video
          src={source}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden
          className="h-full w-full object-cover"
        />
      ) : (
        <img src={source} alt="" className="h-full w-full object-cover" />
      )}
    </span>
  );
};

ProfileFace.displayName = 'ProfileFace';

export { ProfileFace };
