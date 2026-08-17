type ToasterTheme = 'light' | 'dark' | 'system';

type ToasterProps = {
  theme?: ToasterTheme;
  id?: string;
};

export type { ToasterProps, ToasterTheme };
