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
- **Ficha de entrada em papel.** `POST /processos` só recebe a queixa e o prazo. O mecânico preenche com o cliente a ficha
  impressa (`/processos/:id/imprimir/ficha`), o cliente assina e a receção digitaliza-a: anexos `finalidade=ficha_entrada`
  (foto ou PDF) + `PUT /processos/:id/ficha-entrada` com `km` (obrigatório, não pode recuar), `combustivel?` e `pertences?`.
  Sem ficha não se inicia o diagnóstico. Não há assinatura digital na receção nem na aceitação.
- **Condições comerciais** (Definições → `condicoes`, copiadas para o orçamento quando é guardado): % das peças e da mão de obra
  pagas na aceitação (100% / 60%), validade para aceitar (10 dias), parqueamento por dia (2 000 Kz, sem IVA) e dias úteis para
  levantar (5). `valorAceitacao()` em [src/lib/calculos.ts](src/lib/calculos.ts) é a regra única do valor.
- **Pagamento da aceitação.** Depois de aceite, a reparação só começa (tarefas, horas, conclusão) com esse valor recebido;
  a Direção pode dispensá-lo (`POST /processos/:id/pagamento-aceitacao/dispensar`). O servidor devolve `aguardaPagamento`
  em cada processo, também a quem não vê valores.
- **Parqueamento** ([src/lib/parqueamento.ts](src/lib/parqueamento.ts)): conta por dia (inclusive) depois da validade do
  orçamento até à decisão, e depois dos dias úteis a seguir ao aviso de "pronta" até ao levantamento (feriados nacionais
  em [src/lib/datas.ts](src/lib/datas.ts) — confirmar a lista). O aviso regista-se ao enviar uma mensagem com a viatura pronta
  ou com `POST /processos/:id/aviso-levantamento` (telefone/balcão). Fatura-se à parte (`POST …/parqueamento/faturar`,
  numeração FT normal) e tem de estar paga antes da entrega; a Direção pode dispensar (`POST …/parqueamento/dispensar`).
  Os pagamentos indicam a fatura (`fatura` = nº).
- **Sem IVA**: `PUT /processos/:id/orcamento` com `semIva` (+ `motivoIsencaoIva`, por omissão o das Definições): taxa 0 e o
  motivo sai na pró-forma e nas faturas; trabalhos adicionais e parqueamento seguem o mesmo regime.
- **Coordenadas de pagamento** (Definições → `coordenadasPagamento`, IBAN angolano validado) saem na pró-forma, nas faturas
  e no portal do cliente.
- O ciclo do processo (receção → entrega) está todo em [src/api/mock/processos.ts](src/api/mock/processos.ts):
  cada rota documenta as validações e transições que o PHP tem de replicar.
- Comunicações em [src/api/mock/comunicacoes.ts](src/api/mock/comunicacoes.ts): o **email** é enviado pelo PHP
  (SMTP da Hostinger, conta da oficina) e fica `enviada` ou `falhou`; o **WhatsApp** começa por links `wa.me`
  (o operador confirma o envio no seu WhatsApp) e passa mais tarde para a API oficial do WhatsApp Business,
  com estados entregue/lida por webhook. O destino vem sempre da ficha do cliente e exige consentimento.
- Portal do cliente em [src/api/mock/portal.ts](src/api/mock/portal.ts): rotas públicas `/portal/{token}`, em que o
  token (aleatório, `random_bytes`) é a credencial. O PHP deve limitar pedidos por IP nessas rotas, guardar IP e
  user agent nas aprovações e nunca devolver mais do que a projeção `PortalProcesso`. O link expira 30 dias
  depois da entrega. No modo de demonstração o portal só funciona no mesmo navegador (os dados são locais).
- Relatórios e alertas em [src/api/mock/relatorios.ts](src/api/mock/relatorios.ts): `GET /relatorios?de&ate` devolve
  agregados (no PHP, consultas SQL com GROUP BY) e `GET /painel/alertas` os alertas já filtrados pelas permissões.
- Administração em [src/api/mock/administracao.ts](src/api/mock/administracao.ts): contas desativam-se (nunca se apagam),
  palavras-passe com `password_hash`, senha temporária com `mudarSenha` (o servidor só aceita `/auth/*` até ser trocada).
  Cópias de segurança: Cron diário às 03:00 com `mysqldump` + pasta de ficheiros, comprimidos, fora de `public_html`,
  guardados 30 dias; a reposição faz-se por SSH.
- As notificações internas são consultadas a cada minuto (`GET /notificacoes`): o alojamento partilhado não
  mantém ligações abertas em tempo real.

## Deploy (Hostinger)

O site está em **https://mzd.it.ao**. A Hostinger está ligada ao ramo **`main`** e **compila o projecto ela própria**
(`npm install` + `npm run build`, Node 22) e publica a pasta `dist/`. Por isso:

- O `main` contém o **código-fonte**. Cada push para o `main` atualiza o site.
- O workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml) só **verifica** (lint + build) cada push;
  se ficar vermelho, a Hostinger também não vai conseguir compilar.
- O [public/.htaccess](public/.htaccess) vai para `dist/` no build e trata das rotas da aplicação (abrir `/processos/…`
  diretamente ou atualizar a página), dos cabeçalhos de segurança e da cache.

Enquanto não houver backend, o site publicado corre em modo de demonstração. Para usar o PHP, defina a
variável de ambiente `VITE_API_MODE=http` na configuração de build da Hostinger.

O [public/.htaccess](public/.htaccess) encaminha as rotas da aplicação, deixa `/api` para o PHP, bloqueia
ficheiros ocultos e de configuração e define cabeçalhos de segurança (HSTS e Content-Security-Policy: só scripts do próprio site) e de cache. O HTTPS está ativo e forçado no hPanel.

## Site público

`mzd.it.ao` abre o site da oficina para quem não tem sessão iniciada (com sessão, abre o painel); está sempre
disponível em `/site`. Oficina multimarca com especialidade Mitsubishi: abertura neutra ("Todas as marcas. Especialistas
em Mitsubishi."), serviços para qualquer marca, faixa "Reparamos todas as marcas" (só nomes, sem logótipos), como funciona,
a especialidade Mitsubishi (modelos interativos), galeria, testemunhos (só reais) e pedido de orçamento com marca e modelo livres.

- **Gestão:** o administrador do sistema edita tudo em **Site** (`/gestao-site`, permissão `site.gerir`):
  textos, fotografias (enviadas e comprimidas no navegador), modelos, serviços, galeria, testemunhos, contactos
  e o título/descrição para o Google.
- **Pedidos:** o formulário cria um pedido (`POST /site/pedidos`, público, com campo-armadilha e limite por
  número); a receção trata-os em Comunicações → Pedidos do site (ligar, WhatsApp, marcar dia, arquivar).
- **Fotografias:** licença livre do Wikimedia Commons, guardadas em `public/imagens/site/` (não em `public/site/`, que colidiria com o endereço `/site`), com autor e licença em
  "Créditos das fotografias" ([src/lib/site.ts](src/lib/site.ts)). A imagem principal foi retocada (pessoa removida).
- **Marca:** a MZD apresenta-se como oficina independente; não se usa o logótipo da Mitsubishi.
- **SEO:** o site é indexável; a área reservada, o login e o portal do cliente não (`robots.txt` + `noindex`).

## Modos de organização

O mesmo sistema serve oficinas organizadas de formas diferentes, só pela escolha de perfis:

- **Equipa completa** (oficinas maiores): rececionista, administrativa, chefe de oficina e mecânicos usam o sistema,
  cada um na sua etapa.
- **Receção com gestão completa** (ex.: MZD): três níveis — administradores do sistema, Direção e Receção. O perfil
  `rececao` conduz o processo de ponta a ponta. Os técnicos são contas **sem acesso** (`semAcesso`): recebem trabalho
  atribuído, aparecem nos relatórios e no quadro da Oficina, mas não entram; a receção regista o diagnóstico, as
  tarefas e as horas em nome deles (`POST /processos/:id/tempo/manual`). Ficam para a Direção os descontos acima do
  limite, reabrir a caixa, definições, relatórios, contas e auditoria.

As contas reais criam-se na instalação do backend (fora do repositório, que é público).

## Acessibilidade

- Todas as páginas (computador e telemóvel), por perfil, e as janelas principais passam a auditoria axe-core
  (WCAG 2.1 A/AA e boas práticas) sem falhas. Textos secundários usam `text-mzd-gray` (≥ 4,5:1); `zinc-400` só
  sobre fundo escuro ou em elementos decorativos.
- Teclado: "Saltar para o conteúdo", foco no conteúdo ao mudar de página, diálogos com o foco preso e devolvido
  a quem os abriu, menus com setas e Esc. Cada página define o título do separador.
- Um erro numa página mostra uma mensagem útil (e não um ecrã branco); se for uma versão nova publicada
  entretanto, a página recarrega sozinha.

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
| F7 | Comunicações: modelos com variáveis, registo de mensagens, clientes por avisar, notificações internas | ✅ |
| F8 | Portal do cliente: link pessoal, percurso, orçamento e aprovação online, levantamento | ✅ |
| F9 | Painéis por função, alertas "pede atenção", relatórios por período com comparação e CSV | ✅ |
| F10 | Administração: contas da equipa, senha temporária obrigatória, auditoria com filtros, cópias de segurança, estado do sistema | ✅ |
| F11 | Acabamento: WCAG 2.1 AA sem falhas (axe), teclado e foco, títulos, rede de segurança para erros, CSP, Ajuda por função | ✅ |
| F12 | Pedidos da Direção (10/2026): fatura sem IVA, pagamento na aceitação (100% peças + 60% mão de obra), parqueamento, coordenadas de pagamento, ficha de entrada em papel, aceitação do orçamento explicada, site multimarca | ✅ |
