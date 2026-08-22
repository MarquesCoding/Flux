import { Button } from '@FluxUI/Button';

/**
 * What is shown where one page has failed, instead of the whole application going white.
 *
 * Each route draws its own, so a page that throws takes only itself down: the dock, the dialogs and
 * anything playing carry on, and the way out is to go somewhere else rather than to reload.
 */
const PageProblem = () => (
  <main
    role="alert"
    className="mx-auto flex max-w-lg flex-col items-start gap-3 px-5 py-16 sm:px-10"
  >
    <h1 className="text-2xl font-semibold text-text">This page stopped working</h1>

    <p className="text-text-muted">
      Something on this page went wrong. The rest of Valence is still running, so try it again or go
      somewhere else.
    </p>

    <Button
      variant="secondary"
      onClick={() => {
        window.location.reload();
      }}
    >
      Try again
    </Button>
  </main>
);

PageProblem.displayName = 'PageProblem';

export { PageProblem };
