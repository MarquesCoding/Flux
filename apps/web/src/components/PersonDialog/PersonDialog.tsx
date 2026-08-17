import { useEffect, useState } from 'react';
import { RiCloseLine, RiUser3Line } from '@remixicon/react';
import { Button } from '@FluxUI/Button';
import { ReadMore } from '@FluxUI/ReadMore';
import { Dialog } from '@FluxUI/Dialog';
import { DialogContent } from '@FluxUI/DialogContent';
import { Rail } from '@FluxUI/Rail';
import { RevealItem } from '@FluxUI/RevealItem';
import { Skeleton } from '@FluxUI/Skeleton';
import { hasAnythingToShow } from '@FluxContracts/schemas/Person';
import { useQuery } from '@tanstack/react-query';
import { libraryQueries } from '@FluxWeb/query/libraryQueries';
import { RailCard } from '@FluxWeb/components/RailCard/RailCard';
import type { PersonCredits } from '@FluxContracts/schemas/Person';
import type { PersonDialogProps } from './PersonDialog.types';

const NOTHING: PersonCredits = { films: [], shows: [], episodes: [] };

/**
 * Writes a birth date the way somebody says it rather than the way a catalogue stores it, and leaves
 * an unreadable one out rather than showing the raw string back.
 *
 * @param bornOn - The date as the catalogue gave it.
 * @returns The date in words, or null where it could not be read.
 */
const describeBirth = (bornOn: string | null): string | null => {
  if (bornOn === null) {
    return null;
  }

  const at = Date.parse(bornOn);

  return Number.isNaN(at)
    ? null
    : new Date(at).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
};

/**
 * Everything Flux knows about somebody in its cast, and everything of theirs this server can play.
 * Opened from a name in a cast list, which is the moment the question arises — somebody recognises a
 * face and wants to know what else of theirs is here.
 *
 * Only what is held: a filmography naming forty films of which thirty-seven cannot be played is a
 * list of things to be disappointed by. What the catalogue says about them is shown where it says
 * anything and left out entirely where it does not, rather than drawn as empty fields.
 *
 * @param personId - Who to open, or null while nobody is open.
 * @param role - The part they played in whatever this was opened from, where it was opened from one.
 * @param onClose - Told when the dialog was dismissed.
 * @param onPlay - Told to start something of theirs, and where from.
 * @param onInspect - Told to open the page about something of theirs.
 * @param onOpenShow - Told to open a programme of theirs.
 */
const PersonDialog = ({
  personId,
  role,
  onClose,
  onPlay,
  onInspect,
  onOpenShow,
}: PersonDialogProps) => {
  const [lastOpened, setLastOpened] = useState<number | null>(null);

  const asked = useQuery(libraryQueries.person(personId));
  const theirs = useQuery(libraryQueries.credits(personId));

  const person = personId === null ? null : (asked.data ?? null);
  const credits = personId === null ? NOTHING : (theirs.data ?? NOTHING);
  const isLoading = personId !== null && (asked.isPending || theirs.isPending);

  useEffect(() => {
    if (personId !== null) {
      setLastOpened(personId);
    }
  }, [personId]);

  const shown = personId ?? lastOpened;

  if (shown === null) {
    return null;
  }

  const born = describeBirth(person?.bornOn ?? null);
  const said = [born, person?.bornIn ?? null].filter((one) => one !== null);
  const isEmpty = !isLoading && !hasAnythingToShow(person, credits);

  return (
    <Dialog
      label={person?.name ?? 'Somebody in the cast'}
      isOpen={personId !== null}
      onClose={onClose}
      size="stage"
    >
      <DialogContent className="p-0">
        <div className="absolute right-4 top-4 z-10">
          <Button isIconOnly variant="overlay" label="Close" onClick={onClose}>
            <RiCloseLine size={18} aria-hidden />
          </Button>
        </div>

        <div className="flex flex-col gap-8 p-5 pb-10 sm:p-8">
          <header className="flex flex-wrap items-start gap-5">
            <span className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-raised ring-1 ring-white/10">
              {person?.portraitUrl === null || person?.portraitUrl === undefined ? (
                <RiUser3Line size={36} aria-hidden className="text-text-muted" />
              ) : (
                <img
                  src={person.portraitUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              )}
            </span>

            <span className="flex min-w-0 flex-col gap-2">
              <h2 className="text-3xl font-semibold tracking-[-0.02em] text-text">
                {person?.name ?? 'Somebody in the cast'}
              </h2>

              {role === null || role === undefined || role === '' ? null : (
                <span className="font-body text-sm text-text-muted">as {role}</span>
              )}

              {said.length === 0 ? null : (
                <span className="font-body text-sm text-text-muted">{said.join(' · ')}</span>
              )}
            </span>
          </header>

          {isLoading ? (
            <div aria-hidden className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[92%]" />
              <Skeleton className="h-4 w-[70%]" />
            </div>
          ) : null}

          {person?.biography === null || person?.biography === undefined ? null : (
            <ReadMore lines={6}>{person.biography}</ReadMore>
          )}

          {isEmpty ? (
            <p className="font-body text-sm text-text-muted">
              Nothing is known about them, and nothing of theirs is on this server.
            </p>
          ) : null}

          {credits.films.length === 0 ? null : (
            <Rail title="Films" className="px-0">
              {credits.films.map((media, at) => (
                <RevealItem
                  key={media.id}
                  index={at}
                  className="w-[70vw] shrink-0 snap-start sm:w-72 lg:w-80"
                >
                  <RailCard media={media} onPlay={onPlay} onInspect={onInspect} />
                </RevealItem>
              ))}
            </Rail>
          )}

          {credits.shows.length === 0 ? null : (
            <Rail title="Programmes" className="px-0">
              {credits.shows.map((media, at) => (
                <RevealItem
                  key={media.id}
                  index={at}
                  className="w-[70vw] shrink-0 snap-start sm:w-72 lg:w-80"
                >
                  <RailCard
                    media={media}
                    onPlay={onPlay}
                    onInspect={onInspect}
                    {...(onOpenShow === undefined ? {} : { onOpenShow })}
                  />
                </RevealItem>
              ))}
            </Rail>
          )}

          {credits.episodes.length === 0 ? null : (
            <Rail title="Episodes" className="px-0">
              {credits.episodes.map((media, at) => (
                <RevealItem
                  key={media.id}
                  index={at}
                  className="w-[70vw] shrink-0 snap-start sm:w-72 lg:w-80"
                >
                  <RailCard media={media} onPlay={onPlay} onInspect={onInspect} />
                </RevealItem>
              ))}
            </Rail>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

PersonDialog.displayName = 'PersonDialog';

export { PersonDialog };
