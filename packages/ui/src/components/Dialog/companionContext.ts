import { createContext } from 'react';

type CompanionSlot = {
  claim: (id: string) => void;
  release: (id: string) => void;
  current: string | null;
  column: HTMLElement | null;
};

const companionContext = createContext<CompanionSlot | null>(null);

export type { CompanionSlot };

export { companionContext };
