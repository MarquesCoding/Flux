import { useState } from 'react';
import { Button } from '@ValenceUI/Button';
import { DialogCompanion } from '@ValenceUI/DialogCompanion';
import { DialogContent } from '@ValenceUI/DialogContent';
import { DialogFooter } from '@ValenceUI/DialogFooter';
import { DialogTitle } from '@ValenceUI/DialogTitle';
import { DEFAULT_WEBHOOK_FILTERS } from '@ValenceContracts/schemas/Webhook';
import { WebhookFields } from '@ValenceScreens/components/AdminArea/components/WebhookFields/WebhookFields';
import type { WebhookDraft } from '@ValenceScreens/components/AdminArea/components/WebhookFields/WebhookFields.types';
import type { AddWebhookDialogProps } from './AddWebhookDialog.types';

const A_NEW_WEBHOOK: WebhookDraft = {
  name: '',
  url: '',
  preset: 'generic',
  events: ['job.failed'],
  filters: DEFAULT_WEBHOOK_FILTERS,
};

/**
 * Everything needed to point the server at somewhere new: where to deliver, which events to deliver,
 * and what to call it. Any refusal from the server is shown against the form rather than replacing
 * it, so nothing already typed is lost to a rejected address.
 *
 * @param isOpen - Whether the dialog is showing.
 * @param onClose - Called when it is dismissed.
 * @param onCreate - Called with the subscription to make, answering with any refusal.
 * @param accounts - The accounts a new subscription can be narrowed to.
 * @param profiles - The profiles a new subscription can be narrowed to.
 */
const AddWebhookDialog = ({
  isOpen,
  onClose,
  onCreate,
  accounts,
  profiles,
}: AddWebhookDialogProps) => {
  const [draft, setDraft] = useState<WebhookDraft>(A_NEW_WEBHOOK);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isReady = draft.name.trim() !== '' && draft.url.trim() !== '' && draft.events.length > 0;

  const reset = () => {
    setDraft(A_NEW_WEBHOOK);
    setRefusal(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const save = () => {
    setIsSaving(true);
    setRefusal(null);

    void onCreate({ ...draft, name: draft.name.trim(), url: draft.url.trim() })
      .then((answer) => {
        if (answer === null) {
          reset();
          onClose();

          return;
        }

        setRefusal(answer.message);
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  return (
    <DialogCompanion label="Add a webhook" isOpen={isOpen} onClose={close}>
      <DialogTitle
        size="compact"
        title="Add a webhook"
        detail="Valence will post to this address when something you have chosen happens."
      />

      <DialogContent>
        <WebhookFields draft={draft} onChange={setDraft} accounts={accounts} profiles={profiles} />
      </DialogContent>

      <DialogFooter>
        {refusal === null ? null : (
          <span role="alert" className="mr-auto text-sm text-danger">
            {refusal}
          </span>
        )}

        <Button variant="secondary" onClick={close}>
          Cancel
        </Button>

        <Button variant="primary" disabled={!isReady || isSaving} onClick={save}>
          {isSaving ? 'Adding…' : 'Add webhook'}
        </Button>
      </DialogFooter>
    </DialogCompanion>
  );
};

AddWebhookDialog.displayName = 'AddWebhookDialog';

export { AddWebhookDialog };
