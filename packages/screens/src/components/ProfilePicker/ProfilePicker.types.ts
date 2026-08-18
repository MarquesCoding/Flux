import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';

type ProfilePickerProps = {
  profiles: ViewerProfile[];
  onChoose: (profile: ViewerProfile) => void;
  onChanged: () => void;
  isEditable?: boolean;
};

export type { ProfilePickerProps };
