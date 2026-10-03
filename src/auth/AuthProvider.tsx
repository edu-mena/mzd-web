import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { ApiError } from '../api/client';
import { chaves, trocarSessao } from '../api/hooks';
import { AuthContext } from './context';
import { can as podeFazer } from './permissions';
import type { Permissao } from './permissions';

export default function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const { data: user, isPending } = useQuery({
    queryKey: chaves.me,
    queryFn: async () => {
      try {
        return await api.auth.me();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: Infinity,
    retry: false,
  });

  const login = useCallback(
    async (email: string, senha: string) => {
      const u = await api.auth.login(email, senha);
      trocarSessao(qc, u);
      return u;
    },
    [qc]
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      trocarSessao(qc, null);
    }
  }, [qc]);

  const valor = useMemo(
    () => ({
      user: user ?? null,
      carregando: isPending,
      can: (p: Permissao) => podeFazer(user, p),
      login,
      logout,
    }),
    [user, isPending, login, logout]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
