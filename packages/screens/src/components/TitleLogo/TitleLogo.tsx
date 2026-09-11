import { useEffect, useState } from 'react';
import { cn } from '@ValenceUI/cn';
import { isDarkInk } from '@ValenceScreens/library/isDarkInk';
import type { TitleLogoProps } from './TitleLogo.types';

/**
 * A title as its designer lettered it, drawn over artwork.
 *
 * The catalogue's logos are drawn for every kind of ground, and some are black lettering meant for a
 * light poster — laid over a darkened frame they all but vanish. So each is looked at once it has
 * arrived, and one whose lettering is dark is drawn in white instead: the shape the designer gave
 * it, in the one colour that always reads over a picture. Coloured and light logos are left exactly
 * as they are. It stays hidden until it has been looked at, so a black logo is never seen before it
 * turns white.
 *
 * @param src - Where the logo is served from.
 * @param alt - The title, for anybody who cannot see it.
 * @param className - How large it stands, and anything else the caller's layout needs.
 * @param onError - Told when the logo cannot be loaded, so the caller can set the title in type.
 */
const TitleLogo = ({ src, alt, className, onError }: TitleLogoProps) => {
  const [ink, setInk] = useState<'unread' | 'dark' | 'light'>('unread');

  useEffect(() => {
    setInk('unread');
  }, [src]);

  return (
    <img
      src={src}
      alt={alt}
      className={cn(
        className,
        'transition-opacity duration-[var(--duration-base)] ease-[var(--ease-out)]',
        ink === 'unread' ? 'opacity-0' : 'opacity-100',
        ink === 'dark' ? 'brightness-0 invert' : '',
      )}
      onLoad={(event) => {
        setInk(isDarkInk(event.currentTarget) ? 'dark' : 'light');
      }}
      {...(onError === undefined ? {} : { onError })}
    />
  );
};

TitleLogo.displayName = 'TitleLogo';

export { TitleLogo };
