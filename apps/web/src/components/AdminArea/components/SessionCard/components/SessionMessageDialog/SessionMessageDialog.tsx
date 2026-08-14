import { useState } from 'react';
import { Button } from '@FluxUI/Button';
import { Dialog } from '@FluxUI/Dialog';
import { DialogContent } from '@FluxUI/DialogContent';
import { DialogFooter } from '@FluxUI/DialogFooter';
import { DialogTitle } from '@FluxUI/DialogTitle';
import { TextField } from '@FluxUI/TextField';
import { SESSION_MESSAGE_MAX_LENGTH } from '@FluxContracts/schemas/SessionMessage';
import type { SessionMessageDialogProps } from './SessionMessageDialog.types';

/**
 * Where an admin types the thing they want a viewer to read.
 *
 * One line, because it arrives as a banner over somebody's film and the
 * length of the banner is the length of the sentence. The count is shown
 * rather than the typing being cut off, so a sentence that is a few words too
 * long can be shortened deliberately instead of losing its ending.
 */
const SessionMessageDialog = ({
  viewerName,
  isOpen,
  isBusy,
  onClose,
  onSend,
}: SessionMessageDialogProps) => {
  const [text, setText] = useState('');
  const trimmed = text.trim();
  const isTooLong = trimmed.length > SESSION_MESSAGE_MAX_LENGTH;

  const close = () => {
    setText('');
    onClose();
  };

  return (
    <Dialog
      label="Send a message"
      isOpen={isOpen}
      onClose={close}
      className="sm:w-[min(28rem,92vw)]"
    >
      <DialogTitle title="Send a message" />

      <DialogContent>
        <TextField
          label={`Message for ${viewerName}`}
          value={text}
          onValueChange={setText}
          placeholder="I’m restarting the server in five minutes."
          description={`${(SESSION_MESSAGE_MAX_LENGTH - trimmed.length).toString()} characters left. Nothing stops playing — they read it and carry on.`}
          disabled={isBusy}
          hasFocusOnMount
          {...(isTooLong ? { error: 'That is longer than the banner can hold.' } : {})}
        />
      </DialogContent>

      <DialogFooter>
        <Button variant="secondary" isPill onClick={close} disabled={isBusy}>
          Cancel
        </Button>

        <Button
          variant="glossy"
          isPill
          isLoading={isBusy}
          disabled={trimmed.length === 0 || isTooLong}
          onClick={() => {
            onSend(trimmed);
            setText('');
          }}
        >
          Send
        </Button>
      </DialogFooter>
    </Dialog>
  );
};

SessionMessageDialog.displayName = 'SessionMessageDialog';

export { SessionMessageDialog };
