type WebhookFilterChoice = {
  id: string;
  label: string;
};

type WebhookFilterListProps = {
  title: string;
  governs: string;
  choices: WebhookFilterChoice[];
  chosen: string[];
  nothingToChoose: string;
  onChange: (chosen: string[]) => void;
};

export type { WebhookFilterChoice, WebhookFilterListProps };
