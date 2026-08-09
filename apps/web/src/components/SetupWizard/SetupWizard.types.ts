import type { SetupStatus } from '@FluxContracts/schemas/Setup'

type SetupWizardProps = {
  status: SetupStatus
  onComplete: () => void
}

type SetupFormErrors = {
  name?: string
  email?: string
  password?: string
  trustedOrigins?: string
  submit?: string
}

export type { SetupWizardProps, SetupFormErrors }
