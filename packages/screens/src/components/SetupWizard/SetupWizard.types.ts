import type { SetupStatus } from '@ValenceContracts/schemas/Setup';

type SetupWizardProps = {
  status: SetupStatus;
  onComplete: () => void;
};

type SetupFormErrors = {
  name?: string;
  email?: string;
  password?: string;
  trustedOrigins?: string;
  submit?: string;
};

export type { SetupWizardProps, SetupFormErrors };
