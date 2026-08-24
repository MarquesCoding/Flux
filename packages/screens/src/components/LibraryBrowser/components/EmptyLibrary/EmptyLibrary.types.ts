type EmptyLibraryProps = {
  search: string;
  libraryName: string | null;
  hasContentElsewhere: boolean;
  canManage?: boolean;
  onManage?: () => void;
};

export type { EmptyLibraryProps };
