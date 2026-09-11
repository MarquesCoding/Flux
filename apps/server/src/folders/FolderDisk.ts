type FolderEntry = {
  name: string;
  isDirectory: boolean;
  isSymbolicLink: boolean;
};

type DirectoryRead =
  { kind: 'read'; entries: FolderEntry[] } | { kind: 'missing' } | { kind: 'unreadable' };

type FolderDisk = {
  readDirectory: (path: string) => Promise<DirectoryRead>;
  isDirectory: (path: string) => Promise<boolean>;
  roots: () => Promise<string[]>;
};

export type { DirectoryRead, FolderDisk, FolderEntry };
