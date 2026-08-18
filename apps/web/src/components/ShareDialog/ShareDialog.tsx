import { Icon } from '@FluxUI/Icon';
import { Cancel01Icon, Copy01Icon } from '@hugeicons/core-free-icons';
import { useEffect, useState } from 'react';
import { Button } from '@FluxUI/Button';
import { Dialog } from '@FluxUI/Dialog';
import { DialogContent } from '@FluxUI/DialogContent';
import { DialogTitle } from '@FluxUI/DialogTitle';
import { TextField } from '@FluxUI/TextField';
import { Choice } from './components/Choice/Choice';
import { createShare, shareAddress } from '@FluxWeb/sharing/fetchShares';
import type { NewShare } from '@FluxContracts/schemas/Share';
import type { ShareDialogProps } from './ShareDialog.types';

const LASTS = [
  { id: '1', label: 'A day' },
  { id: '3', label: 'Three days' },
  { id: '7', label: 'A week' },
  { id: '30', label: 'A month' },
  { id: 'forever', label: 'Until I withdraw it' },
] as const;

const CAPS = [
  { id: 'any', label: 'Anybody with the link' },
  { id: '1', label: 'One person' },
  { id: '2', label: 'Two people' },
  { id: '5', label: 'Five people' },
] as const;

const HOURS_IN_A_DAY = 24;

const MILLISECONDS_IN_AN_HOUR = 3_600_000;

/**
 * Works out when a link should stop working from the span somebody chose, so that the choice is
 * made in the words a person uses — "a week" — rather than as a date they have to compute.
 *
 * @param lasts - The span chosen, or the choice to keep it until withdrawn.
 * @returns When it should expire, or null where it should not.
 */
const endsAt = (lasts: string): string | null =>
  lasts === 'forever'
    ? null
    : new Date(Date.now() + Number(lasts) * HOURS_IN_A_DAY * MILLISECONDS_IN_AN_HOUR).toISOString();

/**
 * Hands out a link to something, and shows it once. The token is shown here and nowhere else ever
 * again — the server keeps only a hash of it — so this is the one moment it can be copied.
 *
 * The two ways a link can end are offered together and mean different things: "available this
 * weekend" and "one watch only" are both reasonable, and where both are set whichever runs out first
 * ends it.
 *
 * A programme is shared as a programme and nothing else. Opened from an episode there is a choice,
 * because an episode genuinely belongs to both; opened from the programme itself there is nothing to
 * choose, and offering "just this episode" would mean the one the catalogue happened to pick.
 *
 * What is being shared is still said either way. A row with nothing to choose is not a row worth
 * removing: somebody handing out a whole programme should be told that is what they are doing before
 * they press, rather than inferring it from which dialog they happened to open.
 *
 * @param subject - What is being shared, or null while the dialog is shut.
 * @param isOpen - Whether the dialog is showing.
 * @param onClose - Told when it was dismissed.
 * @param origin - Where this server is reachable, which the link is written against.
 */
const ShareDialog = ({ subject, isOpen, onClose, origin }: ShareDialogProps) => {
  const [lasts, setLasts] = useState<string>('7');
  const [cap, setCap] = useState<string>('any');
  const [kind, setKind] = useState<'item' | 'series'>('item');
  const [link, setLink] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setLink(null);
    setRefusal(null);
    setIsCopied(false);
    setKind('item');
  }, [isOpen, subject]);

  const media = subject?.kind === 'item' ? subject.media : null;
  const isEpisode = media !== null && media.seriesId !== null;

  const named =
    subject?.kind === 'series' ? subject.title : (media?.seriesTitle ?? media?.title ?? 'this');

  const hand = async () => {
    if (subject === null) {
      return;
    }

    setIsWorking(true);
    setRefusal(null);

    const asked: NewShare =
      subject.kind === 'series'
        ? { kind: 'series', seriesId: subject.seriesId }
        : kind === 'series' && subject.media.seriesId !== null
          ? { kind: 'series', seriesId: subject.media.seriesId }
          : { kind: 'item', mediaId: subject.media.id };

    const made = await createShare({
      ...asked,
      expiresAt: endsAt(lasts),
      viewCap: cap === 'any' ? null : Number(cap),
    });

    setIsWorking(false);

    if (made === null) {
      setRefusal('That could not be shared. You may not have permission to hand out links.');

      return;
    }

    setLink(shareAddress(made.token, origin ?? window.location.origin));
  };

  return (
    <Dialog label="Share" isOpen={isOpen} onClose={onClose}>
      <DialogContent>
        <DialogTitle title={`Share ${named}`}>
          <Button isIconOnly variant="ghost" label="Close" onClick={onClose}>
            <Icon of={Cancel01Icon} size={20} />
          </Button>
        </DialogTitle>

        {link === null ? (
          <div className="flex flex-col gap-5 pt-2">
            {subject?.kind === 'series' ? (
              <span className="flex items-center justify-between gap-4">
                <span className="shrink-0 text-sm text-text-muted">What to share</span>

                <span className="flex h-9 min-w-0 items-center truncate text-sm font-medium text-text">
                  The whole programme
                </span>
              </span>
            ) : null}

            {isEpisode ? (
              <Choice
                label="What to share"
                value={kind}
                options={[
                  { id: 'item', label: 'Just this episode' },
                  { id: 'series', label: 'The whole programme' },
                ]}
                onSelect={(chosen) => {
                  setKind(chosen === 'series' ? 'series' : 'item');
                }}
              />
            ) : null}

            <Choice label="Lasts" value={lasts} options={LASTS} onSelect={setLasts} />

            <Choice label="Who can watch" value={cap} options={CAPS} onSelect={setCap} />

            <p className="font-body text-xs text-text-muted">
              Anybody holding the link can watch what you shared, and nothing else. You can withdraw
              it at any time, including while somebody is watching.
            </p>

            {refusal === null ? null : <p className="text-sm text-danger">{refusal}</p>}

            <Button
              variant="primary"
              isLoading={isWorking}
              onClick={() => {
                void hand();
              }}
            >
              Make a link
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pt-2">
            <p className="font-body text-sm text-text-muted">
              Copy it now — this is the only time it is shown.
            </p>

            <TextField label="The link" value={link} onValueChange={() => undefined} />

            <Button
              variant="primary"
              onClick={() => {
                void navigator.clipboard.writeText(link).then(() => {
                  setIsCopied(true);
                });
              }}
            >
              <Icon of={Copy01Icon} size={16} />
              {isCopied ? 'Copied' : 'Copy the link'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

ShareDialog.displayName = 'ShareDialog';

export { ShareDialog };
