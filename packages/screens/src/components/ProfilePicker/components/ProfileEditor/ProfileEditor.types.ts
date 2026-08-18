import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';

type ProfileEditorProps = {
  profile: ViewerProfile | null;
  onSaved: () => void;
  onCancel: () => void;
};

export type { ProfileEditorProps };
