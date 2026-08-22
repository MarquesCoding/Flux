import { useState } from 'react';
import { Button } from '@ValenceUI/Button';
import { Dialog } from '@ValenceUI/Dialog';
import { DialogContent } from '@ValenceUI/DialogContent';
import { DialogFooter } from '@ValenceUI/DialogFooter';
import { DialogTitle } from '@ValenceUI/DialogTitle';
import { TextField } from '@ValenceUI/TextField';
import type { PartyPasswordDialogProps } from './PartyPasswordDialog.types';

/**
 * Asks for the password on a party somebody has been invited to.
 *
 * Shown rather than refusing outright, because an invitation with a password on it is still a good
 * invitation — the person opening it has simply not been told the word yet, and being turned away
 * with no way to answer is the one outcome that helps nobody.
 *
 * A wrong answer is said plainly and the field is left as it was, so a second attempt is one key
 * away rather than a fresh trip through the link.
 *
 * @param isOpen - Whether a party is currently asking.
 * @param wasWrong - Whether the last answer given was refused.
 * @param onJoin - Called with the password offered.
 * @param onClose - Called when they give up on it.
 * @returns The dialog.
 */
const PartyPasswordDialog = ({ isOpen, wasWrong, onJoin, onClose }: PartyPasswordDialogProps) => {
  const [password, setPassword] = useState('');

  return (
    <Dialog label="Watch party password" isOpen={isOpen} onClose={onClose}>
      <DialogContent>
        <DialogTitle title="This watch party has a password" />

        <div className="flex flex-col gap-4 pt-2">
          <p className="text-sm leading-relaxed text-text-muted">
            Whoever invited you set one. Ask them for it if you have not been told.
          </p>

          <TextField
            label="Password"
            type="password"
            value={password}
            hasFocusOnMount
            autoComplete="off"
            {...(wasWrong ? { error: 'That is not the password for this party.' } : {})}
            onValueChange={setPassword}
          />
        </div>
      </DialogContent>

      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          Not now
        </Button>

        <Button
          variant="primary"
          disabled={password.length === 0}
          onClick={() => {
            onJoin(password);
          }}
        >
          Join
        </Button>
      </DialogFooter>
    </Dialog>
  );
};

PartyPasswordDialog.displayName = 'PartyPasswordDialog';

export { PartyPasswordDialog };
