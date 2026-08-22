import type { ViewerProfile } from '@ValenceContracts/schemas/ViewerProfile';

type ProfileEditorProps = {
  profile: ViewerProfile | null;
  onSaved: () => void;
  onCancel: () => void;
};

export type { ProfileEditorProps };
