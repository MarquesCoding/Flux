import { Button } from '@FluxUI/Button';
import { platformInUse } from '@FluxClient/platform/installPlatform';

/**
 * The two ways out that only a client with a window of its own has.
 *
 * A browser has neither: it is answered by the page that served it, so it cannot be pointed at
 * another Flux, and it signs somebody in where they already are. Both are therefore asked of the
 * platform rather than assumed, and a browser draws nothing at all here.
 *
 * They live on the way-in screen because that is where somebody is when either goes wrong — an
 * address typed wrong, or a way of signing in this window cannot manage on its own, such as a
 * passkey, which belongs to a real origin and only a real browser has one.
 */
const ThisClientsChoices = () => {
  const { signInElsewhere, changeServer } = platformInUse();

  if (signInElsewhere === null && changeServer === null) {
    return null;
  }

  return (
    <div className="absolute bottom-16 flex items-center gap-2">
      {signInElsewhere === null ? null : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void signInElsewhere.start();
          }}
        >
          Sign in through your browser
        </Button>
      )}

      {changeServer === null ? null : (
        <Button variant="ghost" size="sm" onClick={changeServer}>
          Use a different server
        </Button>
      )}
    </div>
  );
};

ThisClientsChoices.displayName = 'ThisClientsChoices';

export { ThisClientsChoices };
