# MZD Carros e Motores — Gestão de Oficina

Sistema de gestão de processos de oficina automóvel: receção, diagnóstico, orçamento, aprovação do cliente,
reparação, controlo de qualidade, faturação e entrega, com registo de quem fez o quê e quando.

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS 4, TanStack Query, react-hook-form + zod, Recharts.
- **Backend (a construir):** PHP + MySQL na Hostinger. A multimédia fica numa pasta no servidor, servida apenas através do PHP.

## Desenvolvimento

```bash
npm install
npm run dev      # http://localhost:5173
npm run lint
npm run build
```

Por omissão a aplicação corre em **modo de demonstração** (`VITE_API_MODE=mock`): um servidor simulado
no navegador implementa a API e guarda os dados no `localStorage`. Contas de demonstração: ver o ecrã de login
(palavra-passe `mzd2026`). O administrador pode repor os dados em *Definições → Sistema*.

## Sistema visual

"Ficha de oficina de precisão": papel quente, painéis com linhas finas, densidade de ferramenta profissional.

- **Vermelho é sinal**, não decoração: marca, atrasos e situações críticas. Ações principais a tinta (negro).
- **Estados com pouca cor** ([src/lib/estados.ts](src/lib/estados.ts)): neutro = em curso, âmbar = à espera de alguém de fora,
  verde = pronto, apagado = encerrado.
- **Tipografia:** Archivo semi-expandida (títulos), Instrument Sans (texto), IBM Plex Mono (matrículas, nº OS, valores).
- **Componentes** em [src/components/ui](src/components/ui): `Button`/`botao()`, `PageHeader`, `Card`, `StatTile` (com ligação
  para a lista que explica o número), `Matricula`, `StageTrack` (régua de etapas), `StatusBadge`, `Kz`, `Field`/`Input`/`Select`/`Textarea`,
  `Table`, `SearchInput`, `Segmented`, `Aviso`, `Modal`, `Tabs`, `Vazio`/`Carregando`.
- Tokens de cor e tipografia em [src/index.css](src/index.css); tokens dos gráficos em [src/lib/graficos.ts](src/lib/graficos.ts).

## Arquitetura do frontend

```
src/
  api/
    client.ts        # request(): alterna entre o servidor simulado e o PHP (VITE_API_MODE)
    endpoints.ts     # catálogo de rotas da API — o contrato que o PHP tem de cumprir
    hooks.ts         # hooks TanStack Query (cache e invalidação)
    mock/            # implementação de referência da API: rotas, permissões, regras e dados
  auth/              # sessão, matriz de permissões por perfil, proteção de rotas
  lib/calculos.ts    # regra única de totais, IVA e saldos
  documents/         # os 7 documentos oficiais do processo (imprimíveis)
  pages/             # páginas (carregadas sob pedido)
  types.ts           # modelo de dados partilhado com a API
```

### Contrato com o backend PHP

- Pedidos e respostas em JSON em `/api/...`; erros como `{ "erro": "mensagem" }` com `401`, `403`, `404`, `422` ou `429`.
- Sessão por cookie `HttpOnly` + `SameSite`; proteção CSRF por cookie `XSRF-TOKEN` → cabeçalho `X-XSRF-TOKEN`.
- As permissões de `src/auth/permissions.ts` e as regras de avanço de etapa de `src/api/mock/server.ts`
  têm de ser aplicadas **também no servidor**. O frontend só esconde; quem garante a segurança é o PHP.
- Utilizadores sem `valores.ver` (mecânicos) não recebem preços nem faturas nas respostas.
- Ficheiros (fotos, vídeos, assinaturas, comprovativos): `POST /api/processos/:id/anexos` em `multipart/form-data`
  (`ficheiro`, `tipo`, `finalidade?`, `legenda?`). O PHP valida o tipo real com `finfo`, o tamanho, re-codifica imagens
  e guarda **fora de `public_html`**; o `url` devolvido aponta para um endpoint PHP que verifica a sessão.
  Fotos chegam já comprimidas pelo navegador (máx. 1600 px). No modo simulado ficam no IndexedDB.
- O ciclo do processo (receção → entrega) está todo em [src/api/mock/processos.ts](src/api/mock/processos.ts):
  cada rota documenta as validações e transições que o PHP tem de replicar.

## Deploy (Hostinger)

O site está em **mzd.it.ao**. A Hostinger está ligada ao ramo **`main`** e **compila o projecto ela própria**
(`npm install` + `npm run build`, Node 22) e publica a pasta `dist/`. Por isso:

- O `main` contém o **código-fonte**. Cada push para o `main` atualiza o site.
- O workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml) só **verifica** (lint + build) cada push;
  se ficar vermelho, a Hostinger também não vai conseguir compilar.
- O [public/.htaccess](public/.htaccess) vai para `dist/` no build e trata das rotas da aplicação (abrir `/processos/…`
  diretamente ou atualizar a página), dos cabeçalhos de segurança e da cache.

Enquanto não houver backend, o site publicado corre em modo de demonstração. Para usar o PHP, defina a
variável de ambiente `VITE_API_MODE=http` na configuração de build da Hostinger.

O [public/.htaccess](public/.htaccess) encaminha as rotas da aplicação, deixa `/api` para o PHP, bloqueia
ficheiros ocultos e de configuração e define cabeçalhos de segurança e de cache. Ative também *Forçar HTTPS* no hPanel.

## Plano

| Fase | Conteúdo | Estado |
|---|---|---|
| F0 | Fundações: camada de API, autenticação, permissões, regras de etapa, deploy | ✅ |
| F1 | Design system próprio | ✅ |
| F2 | Ciclo completo do processo (receção → entrega), fotos e assinaturas | ✅ |
| F3 | Cadastros de clientes e viaturas, duplicados, pesquisa global (Ctrl+K) | ✅ |
| F4 | Marcações e capacidade, quadro da oficina por mecânico, "As minhas tarefas" | ✅ |
| F5 | Stock: reservas, baixas, custo médio, encomendas e fornecedores | ✅ |
| F6 | Financeiro: recibos, anulações, descontos com aprovação, caixa diária, dívidas, conta corrente | ✅ |
| F7 | Comunicações (WhatsApp/email) | |
| F8 | Portal do cliente | |
| F9 | Painéis por perfil e relatórios | |
| F10 | Administração do sistema | |
| F11 | Acessibilidade, testes e acabamento | |
