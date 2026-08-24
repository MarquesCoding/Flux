import { Icon } from '@ValenceUI/Icon';
import type { NothingHereProps } from './NothingHere.types';

/**
 * Says why a screen is empty, in the one shape every empty screen uses.
 *
 * There were four of these and they agreed on nothing — the films and programmes pages drew a bare
 * paragraph against the left margin, the books page centred a larger heading with no icon, and the
 * home page did a third thing. A household that has just installed Valence sees several of these
 * before it sees anything else, and four answers to the same question read as four different
 * products.
 *
 * Whether it fills the page is the caller's to say, because the same words are a whole screen when
 * nothing has been set up and a note under a heading when one shelf of several is empty.
 *
 * @param of - The icon to draw above it.
 * @param title - What is missing, said in a few words.
 * @param detail - Why, and what would change it, where the title does not already say it.
 * @param action - What to press about it, where there is anything to press.
 * @param fills - Whether this is the whole screen rather than a note within one.
 */
const NothingHere = ({ of, title, detail, action, fills = false }: NothingHereProps) => (
  <section
    className={`flex flex-col items-center gap-4 px-5 text-center ${
      fills ? 'min-h-[70vh] justify-center' : 'py-24'
    }`}
  >
    <Icon of={of} size={56} className="text-text-muted/60" />

    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">{title}</h2>

      {detail === undefined ? null : <p className="max-w-md text-text-muted">{detail}</p>}
    </div>

    {action === undefined ? null : <div className="mt-2">{action}</div>}
  </section>
);

NothingHere.displayName = 'NothingHere';

export { NothingHere };
