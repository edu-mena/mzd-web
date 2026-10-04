// Administração: utilizadores, palavras-passe, auditoria, cópias de segurança e estado do sistema.
//
// Regras (o PHP deve replicá-las):
// - Contas nunca se apagam (o histórico refere-as); desativam-se. Desativar termina as sessões dessa conta.
// - Só o administrador do sistema cria, edita ou repõe administradores; tem de haver sempre um administrador ativo.
// - Ninguém se desativa nem muda o próprio perfil.
// - Contas novas e palavras-passe repostas recebem uma senha temporária (mostrada uma vez) e ficam com
//   `mudarSenha`: até a mudarem, o servidor só aceita /auth/*. O PHP guarda password_hash (bcrypt/argon2).
// - Cópias de segurança: o Cron da Hostinger corre todos os dias às 03:00 (mysqldump + pasta de ficheiros,
//   comprimidos, fora de public_html) e guarda 30 dias. A reposição faz-se por SSH, nunca pela aplicação.

import { ApiError } from '../client';
import type { Metodo } from '../client';
import { db, guardar } from './db';
import type { UtilizadorComSenha } from './seed';
import { auditar, exigir, novoId, publico, texto, umDe, utilizadorAtual } from './contexto';
import type { Handler } from './contexto';
import { can } from '../../auth/permissions';
import { erroSenha } from '../../lib/senha';
import { estaAtivo, PERFIL_LABEL } from '../../types';
import type { CopiaSeguranca, EstadoSistema, Perfil } from '../../types';

const PERFIS = Object.keys(PERFIL_LABEL) as Perfil[];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_COPIAS = 30;

/** Senha temporária legível (sem 0/O nem 1/l), com letras e números. */
export function senhaTemporaria(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const numeros = '23456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const s = [...bytes].map((b, i) => (i % 4 === 3 ? numeros[b % numeros.length] : letras[b % letras.length]));
  return `${s.slice(0, 4).join('')}-${s.slice(4, 8).join('')}-${s.slice(8).join('')}`;
}

const iniciais = (nome: string) => {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  return `${p[0]?.[0] ?? ''}${p.length > 1 ? p[p.length - 1][0] : ''}`.toUpperCase();
};
const adminsAtivos = () => db().utilizadores.filter((x) => x.perfil === 'admin' && x.ativo);

function obterUtilizador(id: string): UtilizadorComSenha {
  const x = db().utilizadores.find((u) => u.id === id);
  if (!x) throw new ApiError(404, 'Utilizador não encontrado.');
  return x;
}

/** Só o administrador do sistema mexe em contas de administrador. */
function exigirSobre(u: UtilizadorComSenha, alvo: { perfil: Perfil }) {
  if (alvo.perfil === 'admin' && !can(u, 'sistema.admin')) throw new ApiError(403, 'Só o administrador do sistema pode gerir contas de administrador.');
}

function validarDados(body: any, ignorarId?: string) {
  const nome = texto(body?.nome, 'Nome', 3, 80);
  const perfil = umDe(body?.perfil, PERFIS, 'Perfil');
  // Técnico sem acesso: só existe para lhe atribuir trabalho; não tem email nem palavra-passe.
  const semAcesso = body?.semAcesso === true;
  if (semAcesso && perfil !== 'mecanico') throw new ApiError(422, 'Só técnicos (mecânicos) podem existir sem acesso ao sistema.');
  const emailBruto = String(body?.email ?? '').trim().toLowerCase();
  const email = semAcesso && !emailBruto ? '' : texto(emailBruto, 'Email', 5, 120);
  if (email && !EMAIL.test(email)) throw new ApiError(422, 'Email inválido.');
  if (email && db().utilizadores.some((x) => x.id !== ignorarId && x.email.toLowerCase() === email)) throw new ApiError(409, 'Já existe uma conta com este email.');
  const telefone = body?.telefone ? String(body.telefone).trim().slice(0, 20) || undefined : undefined;
  return { nome, email, telefone, perfil, semAcesso: semAcesso || undefined };
}

export function criarCopia(tipo: CopiaSeguranca['tipo'], criadoPorId?: string, data = new Date().toISOString()): CopiaSeguranca {
  const base = db();
  // Tamanho aproximado: dados em JSON comprimidos (~1/6).
  return { id: novoId('copia', 'cp'), data, tipo, tamanhoBytes: Math.round(JSON.stringify(base).length / 6), ficheiros: base.anexos.length, criadoPorId };
}

export const rotasAdministracao: [Metodo, string, Handler][] = [
  // ----- Palavra-passe da própria conta -----
  ['POST', '/auth/senha', ({ body }) => {
    const u = utilizadorAtual();
    if (String(body?.atual ?? '') !== u.senha) throw new ApiError(422, 'A palavra-passe atual não está correta.');
    const nova = String(body?.nova ?? '');
    const fraca = erroSenha(nova, { email: u.email, nome: u.nome });
    if (fraca) throw new ApiError(422, fraca);
    if (nova === u.senha) throw new ApiError(422, 'A nova palavra-passe tem de ser diferente da atual.');
    u.senha = nova;
    u.mudarSenha = false;
    auditar(u.id, 'mudar_senha', 'utilizador', u.id);
    guardar();
    return publico(u);
  }],

  // ----- Utilizadores -----
  ['POST', '/utilizadores', ({ body }) => {
    const u = exigir('utilizadores.gerir');
    const dados = validarDados(body);
    exigirSobre(u, dados);
    const senha = senhaTemporaria();
    const novo: UtilizadorComSenha = {
      id: novoId('utilizador', 'u'), ...dados, avatarIniciais: iniciais(dados.nome), ativo: true,
      // Sem acesso: a palavra-passe é aleatória e nunca é mostrada (a conta não entra).
      senha, mudarSenha: !dados.semAcesso, criadoEm: new Date().toISOString(),
    };
    db().utilizadores.push(novo);
    auditar(u.id, 'criar', 'utilizador', novo.id, `${novo.nome} · ${PERFIL_LABEL[novo.perfil]}${dados.semAcesso ? ' · sem acesso' : ''}`);
    guardar();
    return { utilizador: publico(novo), senhaTemporaria: dados.semAcesso ? null : senha };
  }],

  ['PUT', '/utilizadores/:id', ({ params, body }) => {
    const u = exigir('utilizadores.gerir');
    const alvo = obterUtilizador(params.id);
    exigirSobre(u, alvo);
    const dados = validarDados(body, alvo.id);
    exigirSobre(u, dados);
    if (alvo.id === u.id && dados.perfil !== alvo.perfil) throw new ApiError(422, 'Não pode mudar o seu próprio perfil.');
    if (alvo.perfil === 'admin' && dados.perfil !== 'admin' && alvo.ativo && adminsAtivos().length === 1) {
      throw new ApiError(422, 'Tem de existir sempre um administrador do sistema ativo.');
    }
    const mudancas = [
      alvo.perfil !== dados.perfil && `perfil: ${PERFIL_LABEL[alvo.perfil]} → ${PERFIL_LABEL[dados.perfil]}`,
      alvo.email !== dados.email && 'email',
      !!alvo.semAcesso !== !!dados.semAcesso && (dados.semAcesso ? 'acesso retirado' : 'acesso dado'),
    ].filter(Boolean).join(', ');
    // Passa a ter acesso: precisa de uma palavra-passe temporária (botão "Senha") antes de entrar.
    if (alvo.semAcesso && !dados.semAcesso) Object.assign(alvo, { senha: senhaTemporaria(), mudarSenha: true });
    Object.assign(alvo, dados, { avatarIniciais: iniciais(dados.nome) });
    auditar(u.id, 'editar', 'utilizador', alvo.id, mudancas || undefined);
    guardar();
    return publico(alvo);
  }],

  ['PATCH', '/utilizadores/:id/estado', ({ params, body }) => {
    const u = exigir('utilizadores.gerir');
    const alvo = obterUtilizador(params.id);
    exigirSobre(u, alvo);
    const ativo = body?.ativo === true;
    if (!ativo) {
      if (alvo.id === u.id) throw new ApiError(422, 'Não pode desativar a sua própria conta.');
      if (alvo.perfil === 'admin' && adminsAtivos().length === 1) throw new ApiError(422, 'Tem de existir sempre um administrador do sistema ativo.');
      const emCurso = db().processos.filter((p) => p.mecanicoId === alvo.id && estaAtivo(p.estado));
      if (emCurso.length) {
        throw new ApiError(422, `${alvo.nome} tem ${emCurso.length} processo(s) em curso (${emCurso.slice(0, 3).map((p) => p.numero).join(', ')}${emCurso.length > 3 ? '…' : ''}). Reatribua-os primeiro no quadro da Oficina.`);
      }
    }
    alvo.ativo = ativo;
    auditar(u.id, ativo ? 'reativar' : 'desativar', 'utilizador', alvo.id, alvo.nome);
    guardar();
    return publico(alvo);
  }],

  ['POST', '/utilizadores/:id/senha', ({ params }) => {
    const u = exigir('utilizadores.gerir');
    const alvo = obterUtilizador(params.id);
    exigirSobre(u, alvo);
    if (alvo.id === u.id) throw new ApiError(422, 'Para mudar a sua palavra-passe, use "Alterar palavra-passe" no seu menu.');
    if (alvo.semAcesso) throw new ApiError(422, `${alvo.nome} não tem acesso ao sistema. Para lhe dar acesso, edite a conta e indique um email.`);
    const senha = senhaTemporaria();
    alvo.senha = senha;
    alvo.mudarSenha = true;
    auditar(u.id, 'repor_senha', 'utilizador', alvo.id, alvo.nome);
    guardar();
    return { senhaTemporaria: senha };
  }],

  // ----- Auditoria -----
  ['GET', '/auditoria', ({ query }) => {
    exigir('auditoria.ver');
    const de = query.get('de');
    const ate = query.get('ate');
    const utilizadorId = query.get('utilizadorId');
    const entidade = query.get('entidade');
    const q = (query.get('q') ?? '').trim().toLowerCase();
    const tamanho = Math.min(5000, Math.max(1, Number(query.get('tamanho')) || 50));
    const pagina = Math.max(1, Number(query.get('pagina')) || 1);
    const ini = de ? new Date(`${de}T00:00:00`).toISOString() : '';
    const fim = ate ? new Date(`${ate}T23:59:59.999`).toISOString() : '';
    const filtrados = db().auditoria.filter((a) =>
      (!ini || a.data >= ini) && (!fim || a.data <= fim)
      && (!utilizadorId || (utilizadorId === 'sistema' ? a.utilizadorId === null : a.utilizadorId === utilizadorId))
      && (!entidade || a.entidade === entidade)
      && (!q || `${a.acao} ${a.entidade} ${a.entidadeId ?? ''} ${a.detalhe ?? ''}`.toLowerCase().includes(q)));
    return { itens: filtrados.slice((pagina - 1) * tamanho, pagina * tamanho), total: filtrados.length };
  }],

  // ----- Sistema -----
  ['GET', '/sistema/estado', () => {
    exigir('sistema.admin');
    const base = db();
    const ontem = new Date(Date.now() - 86400000).toISOString();
    const estado: EstadoSistema = {
      versaoServidor: 'Demonstração (sem servidor)',
      baseDados: { processos: base.processos.length, clientes: base.clientes.length, viaturas: base.viaturas.length, mensagens: base.mensagens.length, eventosAuditoria: base.auditoria.length },
      anexos: { total: base.anexos.length, bytes: base.anexos.reduce((s, a) => s + a.tamanhoBytes, 0) },
      limiteArmazenamentoBytes: 200 * 1024 ** 3,
      ultimaCopia: [...base.copias].sort((a, b) => b.data.localeCompare(a.data))[0],
      utilizadoresAtivos: base.utilizadores.filter((x) => x.ativo).length,
      loginsFalhados24h: base.auditoria.filter((a) => a.acao === 'login_falhado' && a.data >= ontem).length,
    };
    return estado;
  }],

  ['GET', '/sistema/copias', () => {
    exigir('sistema.admin');
    return [...db().copias].sort((a, b) => b.data.localeCompare(a.data));
  }],

  ['POST', '/sistema/copias', () => {
    const u = exigir('sistema.admin');
    const base = db();
    const c = criarCopia('manual', u.id);
    base.copias = [c, ...base.copias].sort((a, b) => b.data.localeCompare(a.data)).slice(0, MAX_COPIAS);
    auditar(u.id, 'criar', 'copia_seguranca', c.id);
    guardar();
    return c;
  }],

  // No PHP devolve o ficheiro .sql.gz; aqui, os dados de demonstração em JSON (sem palavras-passe).
  ['GET', '/sistema/copias/:id/dados', ({ params }) => {
    const u = exigir('sistema.admin');
    if (!db().copias.some((c) => c.id === params.id)) throw new ApiError(404, 'Cópia não encontrada.');
    auditar(u.id, 'descarregar', 'copia_seguranca', params.id);
    guardar();
    const { utilizadores, ...resto } = db();
    return { ...resto, utilizadores: utilizadores.map(publico) };
  }],
];
