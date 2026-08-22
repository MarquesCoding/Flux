const ADMIN_SECTIONS = [
  { label: null, items: [{ id: 'overview', label: 'Overview' }] },
  {
    label: 'Activity',
    items: [
      { id: 'activity', label: 'Sessions' },
      { id: 'shares', label: 'Links' },
      { id: 'jobs', label: 'Jobs' },
    ],
  },
  {
    label: 'Content',
    items: [
      { id: 'libraries', label: 'Libraries' },
      { id: 'media', label: 'Media' },
    ],
  },
  {
    label: 'People',
    items: [
      { id: 'accounts', label: 'Accounts' },
      { id: 'roles', label: 'Roles' },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'settings', label: 'Settings' },
      { id: 'webhooks', label: 'Webhooks' },
      { id: 'logs', label: 'Logs' },
    ],
  },
] as const;

type AdminPanelId = (typeof ADMIN_SECTIONS)[number]['items'][number]['id'];

const ADMIN_PANELS: readonly { id: AdminPanelId; label: string }[] = ADMIN_SECTIONS.flatMap(
  (section) => [...section.items],
);

export type { AdminPanelId };

export { ADMIN_SECTIONS, ADMIN_PANELS };
