const IMAGE_TYPES = new Map([
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['gif', 'image/gif'],
  ['webp', 'image/webp'],
  ['avif', 'image/avif'],
  ['bmp', 'image/bmp'],
]);

/**
 * What kind of picture a name says it is, where it says it is one at all.
 *
 * An archive of pages holds more than pages — a listing of contents, a note from whoever made it,
 * sometimes a folder thumbnail — and the only thing separating them is the name. It also holds more
 * than one kind of picture: the volumes this was built against store their cover as a photograph and
 * every page after it as a drawing, so the type is read per file rather than assumed once.
 *
 * @param name - The file's name inside the archive.
 * @returns What to serve it as, or nothing where it is not a picture.
 */
const imageTypeFor = (name: string): string | null => {
  const at = name.lastIndexOf('.');

  if (at === -1) {
    return null;
  }

  return IMAGE_TYPES.get(name.slice(at + 1).toLowerCase()) ?? null;
};

export { imageTypeFor };
