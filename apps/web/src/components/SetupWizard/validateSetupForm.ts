import type { SetupFormErrors } from './SetupWizard.types';

const MINIMUM_PASSWORD_LENGTH = 10;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SetupFormValues = {
  name: string;
  email: string;
  password: string;
  trustedOrigins: string;
};

const parseOrigins = (raw: string): string[] =>
  raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

/**
 * Validates the first-run form before it reaches the server.
 *
 * The server validates the same rules; this exists so the operator is told
 * which field is wrong rather than being handed a generic failure.
 */
const validateSetupForm = (values: SetupFormValues): SetupFormErrors => {
  const errors: SetupFormErrors = {};

  if (values.name.trim().length === 0) {
    errors.name = 'Enter a name for the administrator account.';
  }

  if (!EMAIL_PATTERN.test(values.email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (values.password.length < MINIMUM_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MINIMUM_PASSWORD_LENGTH.toString()} characters.`;
  }

  const origins = parseOrigins(values.trustedOrigins);

  if (origins.length === 0) {
    errors.trustedOrigins = 'Enter at least one origin.';
  } else if (origins.some((origin) => URL.parse(origin) === null)) {
    errors.trustedOrigins = 'Each origin must be a full URL, such as http://192.168.1.40:8420.';
  }

  return errors;
};

export type { SetupFormValues };

export { validateSetupForm, parseOrigins, MINIMUM_PASSWORD_LENGTH };
