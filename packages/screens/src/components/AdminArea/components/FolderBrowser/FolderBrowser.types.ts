type FolderBrowserProps = {
  start: string;
  onChoose: (path: string) => void;
  onCancel: () => void;
};

export type { FolderBrowserProps };
