import type {
  WebhookFilters,
  WebhookPreset,
  WebhookSubscribableEvent,
} from '@ValenceContracts/schemas/Webhook';
import type { WebhookFilterChoice } from '@ValenceScreens/components/AdminArea/components/WebhooksPanel/components/WebhookFilterList/WebhookFilterList.types';

type WebhookDraft = {
  name: string;
  url: string;
  preset: WebhookPreset;
  events: WebhookSubscribableEvent[];
  filters: WebhookFilters;
};

type WebhookFieldsProps = {
  draft: WebhookDraft;
  onChange: (draft: WebhookDraft) => void;
  accounts: WebhookFilterChoice[];
  profiles: WebhookFilterChoice[];
};

export type { WebhookDraft, WebhookFieldsProps };
