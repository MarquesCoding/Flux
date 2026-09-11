import { useEffect, useState } from 'react';
import { Button } from '@ValenceUI/Button';
import { Dialog } from '@ValenceUI/Dialog';
import { DialogContent } from '@ValenceUI/DialogContent';
import { DialogFooter } from '@ValenceUI/DialogFooter';
import { DialogTitle } from '@ValenceUI/DialogTitle';
import { isSubscribableEvent } from '@ValenceContracts/schemas/Webhook';
import { WebhookFields } from '@ValenceScreens/components/AdminArea/components/WebhookFields/WebhookFields';
import type { WebhookDraft } from '@ValenceScreens/components/AdminArea/components/WebhookFields/WebhookFields.types';
import type { EditWebhookDialogProps } from './EditWebhookDialog.types';

/**
 * Changes a subscription that already exists, so that trying a different set of events is a matter of
 * ticking a box rather than making a second subscription with a second secret and deleting the first.
 *
 * The signing secret is never touched. Everything else about a subscription can be changed, including
 * where it points — repointing an endpoint is an ordinary thing to want, and the alternative is
 * recreating the subscription and re-signing whatever reads it.
 *
 * @param webhook - The subscription being changed, or nothing where the dialog is closed.
 * @param onClose - Called when it is dismissed.
 * @param onSave - Called with the change to make, answering with any refusal.
 * @param accounts - The accounts this subscription can be narrowed to.
 * @param profiles - The profiles this subscription can be narrowed to.
 */
const EditWebhookDialog = ({
  webhook,
  onClose,
  onSave,
  accounts,
  profiles,
}: EditWebhookDialogProps) => {
  const [draft, setDraft] = useState<WebhookDraft | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(
      webhook === null
        ? null
        : {
            name: webhook.name,
            url: webhook.url,
            preset: webhook.preset,
            events: webhook.events.filter(isSubscribableEvent),
            filters: webhook.filters,
          },
    );
    setRefusal(null);
  }, [webhook]);

  if (webhook === null || draft === null) {
    return null;
  }

  const isReady = draft.name.trim() !== '' && draft.url.trim() !== '' && draft.events.length > 0;

  const save = () => {
    setIsSaving(true);
    setRefusal(null);

    void onSave(webhook.id, { ...draft, name: draft.name.trim(), url: draft.url.trim() })
      .then((answer) => {
        if (answer === null) {
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
    <Dialog label={`Edit ${webhook.name}`} isOpen onClose={onClose}>
      <DialogTitle
        title={`Edit ${webhook.name}`}
        detail="Its signing secret stays as it is, so anything already checking deliveries keeps working."
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

        <Button variant="secondary" isPill onClick={onClose}>
          Cancel
        </Button>

        <Button variant="primary" isPill disabled={!isReady || isSaving} onClick={save}>
          {isSaving ? 'Saving…' : 'Save changes'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
};

EditWebhookDialog.displayName = 'EditWebhookDialog';

export { EditWebhookDialog };
