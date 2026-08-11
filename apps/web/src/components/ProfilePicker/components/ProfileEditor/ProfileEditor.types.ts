import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';

type ProfileEditorProps = {
  /**
   * The profile being changed, or nothing when one is being made.
   */
  profile: ViewerProfile | null;
  onSaved: () => void;
  onCancel: () => void;
};

export type { ProfileEditorProps };
