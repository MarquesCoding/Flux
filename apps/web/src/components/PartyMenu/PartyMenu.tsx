import { useEffect, useState } from 'react';
import { RiGroupFill, RiGroupLine } from '@remixicon/react';
import { PopoverPanel } from '@FluxUI/PopoverPanel';
import { Button } from '@FluxUI/Button';
import { PartyPanel } from '@FluxWeb/components/PartyPanel/PartyPanel';
import type { PartyMenuProps } from './PartyMenu.types';

/**
 * The watch party, from the player's own bar: who is in it and what they may do while it is running,
 * and the way to start one while it is not.
 *
 * It belongs beside the other things a viewer reaches for mid-film rather than in a panel of its own
 * hung over the picture, which is what it was — a party is one of the controls, not a second screen.
 *
 * @param party - The party as the server last described it, or null while there is none.
 * @param meConnectionId - Which member this tab is.
 * @param waitingFor - Whoever the room is waiting for before it can play.
 * @param invitation - The address that puts somebody else in this party.
 * @param isDisabled - Whether the control is inert, as it is while a session is starting.
 * @param onOpen - Called to start a party around what is playing.
 * @param onLeave - Called to leave the party.
 * @param onRemove - Called to put somebody out of the party.
 * @param onSetPassword - Called to put a password on the party, or to take it off.
 * @param people - Everybody with an account here, to be asked along.
 * @param onAsk - Called to ask one of them along.
 * @param isHidden - Whether the bar this sits in has gone, which takes the panel with it.
 * @param onSetRole - Called to change somebody's role.
 * @param onLoosen - Called to change what everybody in the party may do.
 * @param onCopyInvitation - Called to put the invitation on the clipboard.
 * @param onOpenChange - Called as the menu opens or closes, so the bar stays put while it is open.
 */
const PartyMenu = ({
  party,
  meConnectionId,
  waitingFor = [],
  invitation,
  isDisabled = false,
  onOpen,
  onLeave,
  onRemove,
  onSetPassword,
  people,
  onAsk,
  onSetRole,
  onLoosen,
  onCopyInvitation,
  onOpenChange,
  isHidden = false,
}: PartyMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const show = (next: boolean) => {
    setIsOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (isHidden) {
      setIsOpen(false);
    }
  }, [isHidden]);

  const watching = party === null ? 0 : party.members.filter((member) => member.isWatching).length;

  return (
    <PopoverPanel
      label={party === null ? 'Watch party' : `Watch party · ${watching.toString()} watching`}
      heading="Watch party"
      isDisabled={isDisabled}
      isOpen={isOpen}
      onOpenChange={show}
      trigger={
        party === null ? (
          <RiGroupLine size={20} aria-hidden />
        ) : (
          <RiGroupFill size={20} aria-hidden />
        )
      }
      className="mb-7.5"
    >
      {party === null ? (
        <div className="flex w-72 max-w-full flex-col gap-3 text-white">
          <p className="text-xs leading-relaxed text-white/70">
            Watch this with other people here, in step. You get a link to send them, and whatever
            anybody plays, pauses or skips happens for everybody.
          </p>

          <Button
            variant="secondary"
            size="sm"
            isPill
            onClick={() => {
              show(false);
              onOpen?.();
            }}
          >
            Start a watch party
          </Button>
        </div>
      ) : (
        <PartyPanel
          party={party}
          meConnectionId={meConnectionId}
          waitingFor={waitingFor}
          {...(invitation === undefined ? {} : { invitation })}
          {...(onLeave === undefined ? {} : { onLeave })}
          {...(onSetRole === undefined ? {} : { onSetRole })}
          {...(onLoosen === undefined ? {} : { onLoosen })}
          {...(onRemove === undefined ? {} : { onRemove })}
          {...(onSetPassword === undefined ? {} : { onSetPassword })}
          {...(people === undefined ? {} : { people })}
          {...(onAsk === undefined ? {} : { onAsk })}
          {...(onCopyInvitation === undefined ? {} : { onCopyInvitation })}
        />
      )}
    </PopoverPanel>
  );
};

PartyMenu.displayName = 'PartyMenu';

export { PartyMenu };
