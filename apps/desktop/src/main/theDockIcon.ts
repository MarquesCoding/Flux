import { join } from 'node:path';
import { app } from 'electron';

/**
 * Puts Valence's icon in the dock, for the platform that takes it from the running application rather
 * than from the window.
 *
 * A window's icon is not a dock icon on macOS: the dock reads the bundle, and while this is being
 * worked on the bundle is Electron's own — so the dock shows an atom no matter what the window was
 * given. A packaged Valence takes its own icon from its own bundle and never needs this, which is
 * exactly why it is easy to leave broken for everybody who runs it from source.
 */
const theDockIcon = (): void => {
  app.dock?.setIcon(join(app.getAppPath(), 'build/icon.png'));
};

export { theDockIcon };
