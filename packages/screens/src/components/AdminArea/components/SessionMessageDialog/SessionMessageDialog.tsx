import { Icon } from '@ValenceUI/Icon';
import { XIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Button } from '@ValenceUI/Button';
import { Dialog } from '@ValenceUI/Dialog';
import { DialogContent } from '@ValenceUI/DialogContent';
import { DialogFooter } from '@ValenceUI/DialogFooter';
import { DialogTitle } from '@ValenceUI/DialogTitle';
import { TextField } from '@ValenceUI/TextField';
import { SESSION_MESSAGE_MAX_LENGTH } from '@ValenceContracts/schemas/SessionMessage';
import type { SessionMessageDialogProps } from './SessionMessageDialog.types';

/**
 * Where an operator types the line a viewer will read.
 *
 * The length is shown rather than enforced by truncation, because a sentence three words too long
 * should be shortened deliberately by the person writing it — silently losing its ending is how a
 * message comes out meaning something else.
 *
 * @param watcher - Who is going to read it, so the operator can see they picked the right screen.
 * @param isOpen - Whether the dialog is showing.
 * @param onSend - Called with the message to deliver.
 * @param onClose - Called when it is dismissed.
 * @returns The dialog.
 */
const SessionMessageDialog = ({ watcher, isOpen, onSend, onClose }: SessionMessageDialogProps) => {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setText('');
      setIsSending(false);
    }
  }, [isOpen]);

  const trimmed = text.trim();
  const isTooLong = trimmed.length > SESSION_MESSAGE_MAX_LENGTH;
  const canSend = trimmed !== '' && !isTooLong && !isSending;

  const send = async () => {
    setIsSending(true);
    await onSend(trimmed);
    setIsSending(false);
    onClose();
  };

  return (
    <Dialog label="Send a message" isOpen={isOpen} onClose={onClose}>
      <DialogTitle title={`Message ${watcher}`}>
        <Button isIconOnly variant="ghost" label="Close" size="sm" onClick={onClose}>
          <Icon of={XIcon} size={16} />
        </Button>
      </DialogTitle>

      <DialogContent>
        <div className="flex flex-col gap-2">
          <TextField
            label="What to tell them"
            value={text}
            onValueChange={setText}
            placeholder="Restarting in five minutes"
            hasFocusOnMount
            {...(isTooLong ? { error: 'That is too long to fit on the banner.' } : {})}
          />

          <p className="text-xs text-text-muted">
            {`${trimmed.length.toString()} of ${SESSION_MESSAGE_MAX_LENGTH.toString()} characters. This will not pause what they are watching.`}
          </p>
        </div>
      </DialogContent>

      <DialogFooter>
        <Button variant="ghost" size="sm" isPill onClick={onClose}>
          Cancel
        </Button>

        <Button
          variant="primary"
          size="sm"
          isPill
          disabled={!canSend}
          isLoading={isSending}
          onClick={() => {
            void send();
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
