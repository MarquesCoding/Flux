type TwoFactorSetupProps = {
  isEnabled: boolean;
  onChanged: () => void;
};

type SetupStage = 'idle' | 'confirmPassword' | 'showSecret' | 'disable';

type Enrollment = {
  totpURI: string;
  secret: string;
  backupCodes: string[];
};

export type { TwoFactorSetupProps, SetupStage, Enrollment };
