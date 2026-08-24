import { describeDevice } from '@ValenceServer/account/describeDevice';
import type { WebhookOccurrence } from '@ValenceServer/events/EventBus';

const SIGN_IN_PATH = '/sign-in';

const REFUSED = 'those details were not accepted.';

type SignInAttempt = {
  path: string;
  statusCode: number | null;
  account: { id: string; name: string } | null;
  identifier: string | null;
  userAgent: string | null;
  address: string | null;
};

/**
 * Turns one finished sign-in request into the event worth telling somebody about, or into nothing.
 *
 * A failure says which identifier was tried and never why it was refused. "Wrong password" and "no
 * such account" are the same sentence here on purpose: told apart, a webhook pointed at a chat
 * channel becomes an account-enumeration oracle that anybody in that channel can read.
 *
 * @param attempt - The request, as the hook that watched it finish saw it.
 * @returns What to publish, or nothing where this was not a sign-in worth reporting.
 */
const describeSignInAttempt = (attempt: SignInAttempt): WebhookOccurrence | null => {
  if (!attempt.path.startsWith(SIGN_IN_PATH)) {
    return null;
  }

  const deviceLabel = describeDevice(attempt.userAgent);

  if (attempt.account !== null) {
    return {
      event: 'auth.succeeded',
      data: {
        accountId: attempt.account.id,
        name: attempt.account.name,
        deviceLabel,
        address: attempt.address,
      },
    };
  }

  if (attempt.statusCode === null || attempt.statusCode < 400) {
    return null;
  }

  return {
    event: 'auth.failed',
    data: {
      identifier: attempt.identifier ?? 'somebody who gave no address',
      deviceLabel,
      address: attempt.address,
      reason: REFUSED,
    },
  };
};

export type { SignInAttempt };

export { describeSignInAttempt };
