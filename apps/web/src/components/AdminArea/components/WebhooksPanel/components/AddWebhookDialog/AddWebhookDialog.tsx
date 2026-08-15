import { useState } from 'react';
import { Button } from '@FluxUI/Button';
import { Checkbox } from '@FluxUI/Checkbox';
import { Dialog } from '@FluxUI/Dialog';
import { DialogContent } from '@FluxUI/DialogContent';
import { DialogFooter } from '@FluxUI/DialogFooter';
import { DialogTitle } from '@FluxUI/DialogTitle';
import { TextField } from '@FluxUI/TextField';
import {
  WEBHOOK_EVENTS,
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_PRESETS,
} from '@FluxContracts/schemas/Webhook';
import type { WebhookEvent, WebhookPreset } from '@FluxContracts/schemas/Webhook';
import type { AddWebhookDialogProps } from './AddWebhookDialog.types';

const PRESET_LABELS: Record<WebhookPreset, string> = {
  generic: 'Flux’s own envelope, as JSON — build against this one',
  discord: 'A message in a Discord channel',
  ntfy: 'A notification through ntfy',
};

const DEFAULT_EVENTS: WebhookEvent[] = ['job.failed'];

/**
 * Everything needed to point the server at somewhere new.
 */
const AddWebhookDialog = ({ isOpen, onClose, onCreate }: AddWebhookDialogProps) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [preset, setPreset] = useState<WebhookPreset>('generic');
  const [events, setEvents] = useState<WebhookEvent[]>(DEFAULT_EVENTS);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isReady = name.trim() !== '' && url.trim() !== '' && events.length > 0;

  const reset = () => {
    setName('');
    setUrl('');
    setPreset('generic');
    setEvents(DEFAULT_EVENTS);
    setRefusal(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const save = () => {
    setIsSaving(true);
    setRefusal(null);

    void onCreate({ name: name.trim(), url: url.trim(), preset, events })
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
    <Dialog label="Add a webhook" isOpen={isOpen} onClose={close}>
      <DialogTitle
        title="Add a webhook"
        detail="Flux will post to this address when something you have chosen happens."
      />

      <DialogContent>
        <div className="flex flex-col gap-4">
          <TextField
            label="Name"
            value={name}
            onValueChange={setName}
            placeholder="Discord"
            description="What this is called in the list. Only you see it."
            required
          />

          <TextField
            label="Address"
            type="url"
            value={url}
            onValueChange={setUrl}
            placeholder="https://discord.com/api/webhooks/…"
            description="Where the deliveries are posted."
            required
            {...(refusal === null ? {} : { error: refusal })}
          />

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-text">Shape</span>

            <div className="flex flex-col gap-1.5">
              {WEBHOOK_PRESETS.map((candidate) => (
                <Button
                  key={candidate}
                  variant={preset === candidate ? 'secondary' : 'bare'}
                  size="none"
                  isPill
                  aria-pressed={preset === candidate}
                  className="flex flex-col items-start gap-0.5 px-3 py-2 text-left"
                  onClick={() => {
                    setPreset(candidate);
                  }}
                >
                  <span className="text-sm text-text">{candidate}</span>
                  <span className="text-xs text-text-muted">{PRESET_LABELS[candidate]}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-text">Tell me about</span>

            <div className="flex flex-col gap-1.5">
              {WEBHOOK_EVENTS.map((event) => (
                <Checkbox
                  key={event}
                  label={WEBHOOK_EVENT_LABELS[event]}
                  checked={events.includes(event)}
                  onCheckedChange={(checked) => {
                    setEvents((held) =>
                      checked ? [...held, event] : held.filter((one) => one !== event),
                    );
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>

      <DialogFooter>
        <Button variant="secondary" isPill onClick={close}>
          Cancel
        </Button>

        <Button variant="primary" isPill disabled={!isReady || isSaving} onClick={save}>
          {isSaving ? 'Adding…' : 'Add webhook'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
};

AddWebhookDialog.displayName = 'AddWebhookDialog';

export { AddWebhookDialog };
