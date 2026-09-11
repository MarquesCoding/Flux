type PathSegment = {
  label: string;
  path: string;
};

/**
 * Breaks a folder's path into the folders leading to it, each with the path that opens it — a trail
 * somebody can step back along. Reads a Windows path by its drive letter and backslashes, and any
 * other by its slashes.
 *
 * @param path - A full path, from the root.
 * @returns The root, then each folder on the way down, ending with the one given.
 */
const pathSegments = (path: string): PathSegment[] => {
  const drive = /^([A-Za-z]:)[\\/]?/.exec(path);
  const separator = drive === null ? '/' : '\\';
  const root = drive === null ? '/' : `${drive[1] ?? ''}\\`;
  const rest = path
    .slice(drive === null ? 0 : drive[0].length)
    .split(/[\\/]/)
    .filter((part) => part !== '');

  const segments: PathSegment[] = [{ label: root, path: root }];
  let built = root;

  for (const part of rest) {
    built = built.endsWith(separator) ? `${built}${part}` : `${built}${separator}${part}`;
    segments.push({ label: part, path: built });
  }

  return segments;
};

export type { PathSegment };

export { pathSegments };
