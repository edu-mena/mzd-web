import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { Utilizador } from '../types';
import { utilizadorAtual } from '../data/mock';

interface UserCtx {
  user: Utilizador;
  setUser: (u: Utilizador) => void;
}

const Ctx = createContext<UserCtx>({ user: utilizadorAtual, setUser: () => {} });

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Utilizador>(utilizadorAtual);
  return <Ctx.Provider value={{ user, setUser }}>{children}</Ctx.Provider>;
}

export function useUser() {
  return useContext(Ctx);
}
