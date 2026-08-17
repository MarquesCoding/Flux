import { createContext } from 'react';
import type { Shell } from './shell.types';

const shellContext = createContext<Shell | null>(null);

export { shellContext };
