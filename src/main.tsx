import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App.tsx';
import { ApiError, iniciarApi } from './api/client';
import { chaves } from './api/hooks';

// Se qualquer pedido devolver 401, a sessão terminou: limpa-se o utilizador e o RequireAuth envia para /login.
const terminarSessaoSe401 = (erro: unknown) => {
  if (erro instanceof ApiError && erro.status === 401) queryClient.setQueryData(chaves.me, null);
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: terminarSessaoSe401 }),
  mutationCache: new MutationCache({ onError: terminarSessaoSe401 }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (n, erro) => !(erro instanceof ApiError && [401, 403, 404, 410].includes(erro.status)) && n < 2,
    },
  },
});

// Primeiro decide-se se fala com o backend PHP ou com a demonstração (ver api/client.ts).
void iniciarApi().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
});
