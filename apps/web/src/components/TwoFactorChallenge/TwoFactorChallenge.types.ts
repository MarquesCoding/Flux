type TwoFactorChallengeProps = {
  onVerified: () => void;
};

type ChallengeMode = 'totp' | 'backup';

export type { TwoFactorChallengeProps, ChallengeMode };
