type TwoFactorChallengeProps = {
  onVerified: () => void
  onCancel: () => void
}

type ChallengeMode = 'totp' | 'backup'

export type { TwoFactorChallengeProps, ChallengeMode }
