type ToasterTheme = 'light' | 'dark' | 'system';

type ToasterPosition = 'top-center' | 'bottom-right';

type ToasterProps = {
  theme?: ToasterTheme;
  id?: string;
  position?: ToasterPosition;
};

export type { ToasterProps, ToasterTheme, ToasterPosition };
