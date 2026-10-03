import { createContext } from 'react';
import type { Utilizador } from '../types';
import type { Permissao } from './permissions';

export interface AuthCtx {
  user: Utilizador | null;
  carregando: boolean;
  can: (permissao: Permissao) => boolean;
  login: (email: string, senha: string) => Promise<Utilizador>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthCtx | null>(null);
