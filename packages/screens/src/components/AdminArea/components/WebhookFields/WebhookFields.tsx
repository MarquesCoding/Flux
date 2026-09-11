import { useState } from 'react';
import { Button } from '@ValenceUI/Button';
import { Checkbox } from '@ValenceUI/Checkbox';
import { SegmentedRow } from '@ValenceUI/SegmentedRow';
import { Tabs } from '@ValenceUI/Tabs';
import { TabRow } from '@ValenceUI/TabRow';
import { TabPanel } from '@ValenceUI/TabPanel';
import { TextField } from '@ValenceUI/TextField';
import {
  WEBHOOK_EVENT_GROUPS,
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_EVENT_NOTES,
  WEBHOOK_PRESETS,
} from '@ValenceContracts/schemas/Webhook';
import { MEDIA_KINDS, MEDIA_KIND_LABELS } from '@ValenceContracts/schemas/MediaKind';
import { WebhookFilterList } from '@ValenceScreens/components/AdminArea/components/WebhooksPanel/components/WebhookFilterList/WebhookFilterList';
import type { MediaKind } from '@ValenceContracts/schemas/MediaKind';
import type { WebhookPreset, WebhookSubscribableEvent } from '@ValenceContracts/schemas/Webhook';
import type { WebhookFieldsProps } from './WebhookFields.types';

const PRESET_LABELS: Record<WebhookPreset, string> = {
  generic: 'Valence’s own envelope, as JSON — build against this one',
  discord: 'A message in a Discord channel',
  ntfy: 'A notification through ntfy',
};

const ARRIVAL_CHOICES = [
  { id: 'perScan', label: 'Once per scan' },
  { id: 'perItem', label: 'One for each thing' },
] as const;

const ITEM_TYPE_CHOICES = MEDIA_KINDS.map((kind) => ({
  id: kind,
  label: MEDIA_KIND_LABELS[kind],
}));

const PANES = [
  { id: 'where', label: 'Where' },
  { id: 'events', label: 'Events' },
  { id: 'who', label: 'Who' },
] as const;

/**
 * Narrows a chosen id back to a kind, since a filter list hands back plain strings.
 *
 * @param candidate - What was chosen.
 * @returns Whether it names a kind.
 */
const isMediaKind = (candidate: string): candidate is MediaKind =>
  MEDIA_KINDS.some((kind) => kind === candidate);

/**
 * Everything there is to say about a subscription, asked three questions at a time: where deliveries
 * go, what they are about, and whom they are about.
 *
 * Three panes rather than one column, because there are better than thirty controls here and a
 * single scroll of them reads as a wall — an operator changing which events they want should not
 * have to walk past every account on the server to reach the buttons.
 *
 * One form rather than two, because making a subscription and changing one ask exactly the same
 * questions, and a form that had drifted between the two would let an operator set something on
 * creation they could never change afterwards.
 *
 * @param draft - The subscription as it currently reads.
 * @param onChange - Told the whole draft again whenever any part of it changes.
 * @param accounts - The accounts this subscription can be narrowed to.
 * @param profiles - The profiles this subscription can be narrowed to.
 */
const WebhookFields = ({ draft, onChange, accounts, profiles }: WebhookFieldsProps) => {
  const [pane, setPane] = useState<string>(PANES[0].id);

  const setEvents = (events: WebhookSubscribableEvent[]) => {
    onChange({ ...draft, events });
  };

  return (
    <Tabs value={pane} onValueChange={setPane}>
      <TabRow label="What to change" tone="underlined" size="sm" groups={[{ items: PANES }]} />

      <TabPanel value="where">
        <div className="flex flex-col gap-4 pt-4">
          <TextField
            label="Name"
            value={draft.name}
            onValueChange={(name) => {
              onChange({ ...draft, name });
            }}
            placeholder="Discord"
            description="What this is called in the list. Only you see it."
            required
          />

          <TextField
            label="Address"
            type="url"
            value={draft.url}
            onValueChange={(url) => {
              onChange({ ...draft, url });
            }}
            placeholder="https://discord.com/api/webhooks/…"
            description="Where the deliveries are posted."
            required
          />

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-text">Shape</span>

            <div className="flex flex-col gap-1.5">
              {WEBHOOK_PRESETS.map((candidate) => (
                <Button
                  key={candidate}
                  variant={draft.preset === candidate ? 'secondary' : 'bare'}
                  size="none"
                  isPill
                  aria-pressed={draft.preset === candidate}
                  className="flex flex-col items-start gap-0.5 px-3 py-2 text-left"
                  onClick={() => {
                    onChange({ ...draft, preset: candidate });
                  }}
                >
                  <span className="text-sm text-text">{candidate}</span>
                  <span className="text-xs text-text-muted">{PRESET_LABELS[candidate]}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </TabPanel>

      <TabPanel value="events">
        <div className="flex flex-col gap-5 pt-4">
          {WEBHOOK_EVENT_GROUPS.map((group) => {
            const chosenHere = group.events.filter((event) => draft.events.includes(event));
            const isEveryOne = chosenHere.length === group.events.length;

            return (
              <div key={group.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-text">{group.label}</span>

                  <Button
                    variant="bare"
                    size="sm"
                    isPill
                    onClick={() => {
                      setEvents(
                        isEveryOne
                          ? draft.events.filter((event) => !group.events.includes(event))
                          : [
                              ...draft.events,
                              ...group.events.filter((event) => !draft.events.includes(event)),
                            ],
                      );
                    }}
                  >
                    {isEveryOne ? 'None' : 'All'}
                  </Button>
                </div>

                <div role="group" aria-label={group.label} className="flex flex-col gap-1.5">
                  {group.events.map((event) => (
                    <Checkbox
                      key={event}
                      label={WEBHOOK_EVENT_LABELS[event]}
                      {...(WEBHOOK_EVENT_NOTES[event] === undefined
                        ? {}
                        : { description: WEBHOOK_EVENT_NOTES[event] })}
                      checked={draft.events.includes(event)}
                      onCheckedChange={(checked) => {
                        setEvents(
                          checked
                            ? [...draft.events, event]
                            : draft.events.filter((one) => one !== event),
                        );
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </TabPanel>

      <TabPanel value="who">
        <div className="flex flex-col gap-5 pt-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-text">When things arrive</span>
              <span className="text-xs text-text-muted">
                A first scan of a large library arrives all at once. One message per scan keeps that
                readable; one for each thing does not.
              </span>
            </div>

            <SegmentedRow
              label="How arrivals are reported"
              tone="accent"
              size="sm"
              items={ARRIVAL_CHOICES}
              value={draft.filters.mediaAdded}
              onSelect={(id) => {
                onChange({
                  ...draft,
                  filters: {
                    ...draft.filters,
                    mediaAdded: id === 'perItem' ? 'perItem' : 'perScan',
                  },
                });
              }}
            />
          </div>

          <WebhookFilterList
            title="Accounts"
            governs="Decides whose sign-ins and account changes are reported."
            choices={accounts}
            chosen={draft.filters.accounts}
            nothingToChoose="This server has no other accounts yet."
            onChange={(chosen) => {
              onChange({ ...draft, filters: { ...draft.filters, accounts: chosen } });
            }}
          />

          <WebhookFilterList
            title="Profiles"
            governs="Decides whose watching is reported."
            choices={profiles}
            chosen={draft.filters.profiles}
            nothingToChoose="This server has no profiles yet."
            onChange={(chosen) => {
              onChange({ ...draft, filters: { ...draft.filters, profiles: chosen } });
            }}
          />

          <WebhookFilterList
            title="Kinds"
            governs="Decides which kinds of thing are reported, arriving or being watched."
            choices={ITEM_TYPE_CHOICES}
            chosen={draft.filters.itemTypes}
            nothingToChoose="Nothing to choose from."
            onChange={(chosen) => {
              onChange({
                ...draft,
                filters: { ...draft.filters, itemTypes: chosen.filter(isMediaKind) },
              });
            }}
          />
        </div>
      </TabPanel>
    </Tabs>
  );
};

WebhookFields.displayName = 'WebhookFields';

export { WebhookFields };
