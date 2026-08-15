import { useEffect, useState } from 'react';
import { cn } from '@FluxUI/cn';
import { profileInitial, profileAvatarUrl } from '@FluxContracts/schemas/ViewerProfile';
import type { ProfileFaceProps } from './ProfileFace.types';

/**
 * What a profile looks like.
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
