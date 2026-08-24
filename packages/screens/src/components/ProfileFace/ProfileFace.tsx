import { useEffect, useState } from 'react';
import { cn } from '@ValenceUI/cn';
import { profileInitial, profileAvatarUrl } from '@ValenceContracts/schemas/ViewerProfile';
import type { ProfileFaceProps } from './ProfileFace.types';

/**
 * Draws what a profile looks like — their photograph, their drawn avatar, or their initial — and
 * shows a photograph being uploaded before the server has taken it, so choosing one feels immediate.
 *
 * @param profile - Whose face to draw.
 * @param pending - A photograph being uploaded, drawn in place of the stored one.
 * @param className - Extra classes for the caller's own layout.
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
        'flex items-center justify-center overflow-hidden bg-subtle font-semibold text-text',
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
