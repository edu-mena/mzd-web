// Servidor simulado: implementa no browser o mesmo contrato HTTP que o backend PHP terá de cumprir
// (rotas, códigos de erro, permissões e regras de negócio). Ver src/api/endpoints.ts.

import { ApiError } from '../client';
import type { Metodo } from '../client';
import { db, definirSessao, guardar, reporDemo, sessaoAtual } from './db';
import { auditar, exigir, novoId, obterProcesso, publico, utilizadorAtual } from './contexto';
import type { Handler } from './contexto';
import { rotasProcessos } from './processos';
import { rotasClientes } from './clientes';
import { rotasAgenda } from './agenda';
import { rotasStock } from './stock';
import { rotasFinanceiro } from './financeiro';
import { rotasComunicacoes } from './comunicacoes';
import { guardarFicheiro, limparFicheiros, PREFIXO_URL_MOCK } from './ficheiros';
import { estaAtivo } from '../../types';
import type { Anexo, Configuracao, FinalidadeAnexo } from '../../types';

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MS = 60_000;
const tentativas = new Map<string, { n: number; ate?: number }>();

const rotas: [Metodo, string, Handler][] = [
  // Autenticação
  ['POST', '/auth/login', ({ body }) => {
    const email = String(body?.email ?? '').trim().toLowerCase();
    const senha = String(body?.senha ?? '');
    const estado = tentativas.get(email);
    if (estado?.ate && estado.ate > Date.now()) {
      throw new ApiError(429, 'Demasiadas tentativas falhadas. Aguarde um minuto e tente novamente.');
    }
    const u = db().utilizadores.find((x) => x.email.toLowerCase() === email);
    if (!u || u.senha !== senha || !u.ativo) {
      const n = (estado?.n ?? 0) + 1;
      tentativas.set(email, { n, ate: n >= MAX_TENTATIVAS ? Date.now() + BLOQUEIO_MS : undefined });
      auditar(u?.id ?? null, 'login_falhado', 'sessao', undefined, email);
      guardar();
      throw new ApiError(401, 'Email ou palavra-passe incorretos.');
    }
    tentativas.delete(email);
    definirSessao(u.id);
    auditar(u.id, 'login', 'sessao');
    guardar();
    return publico(u);
  }],
  ['POST', '/auth/logout', () => {
    const id = sessaoAtual();
    if (id) auditar(id, 'logout', 'sessao');
    definirSessao(null);
    guardar();
    return undefined;
  }],
  ['GET', '/auth/me', () => publico(utilizadorAtual())],

  // Utilizadores
  ['GET', '/utilizadores', () => {
    utilizadorAtual();
    return db().utilizadores.map(publico);
  }],

  ...rotasClientes,
  ...rotasAgenda,
  ...rotasProcessos,

  ...rotasStock,
  ...rotasFinanceiro,
  ...rotasComunicacoes,

  // Configuração
  ['GET', '/configuracao', () => {
    utilizadorAtual();
    return db().configuracao;
  }],
  ['PUT', '/configuracao', ({ body }) => {
    const u = exigir('definicoes.gerir');
    const nova = body as Configuracao;
    if (!(nova.taxaIva >= 0 && nova.taxaIva <= 100)) throw new ApiError(422, 'Taxa de IVA inválida.');
    if (!(nova.valorHora > 0)) throw new ApiError(422, 'O valor por hora tem de ser positivo.');
    db().configuracao = nova;
    auditar(u.id, 'atualizar', 'configuracao');
    guardar();
    return nova;
  }],

  // Auditoria
  ['GET', '/auditoria', () => {
    exigir('sistema.admin');
    return db().auditoria;
  }],

  // Apenas no modo simulado
  ['POST', '/demo/repor', () => {
    exigir('sistema.admin');
    reporDemo();
    void limparFicheiros().catch(() => undefined);
    definirSessao(null);
    return undefined;
  }],
];

// ---------- Despacho ----------

function corresponder(padrao: string, caminho: string): Record<string, string> | null {
  const a = padrao.split('/');
  const b = caminho.split('/');
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

const latencia = () => new Promise((r) => setTimeout(r, 120 + Math.random() * 180));

export async function handle<T>(method: Metodo, path: string, body?: unknown): Promise<T> {
  await latencia();
  const [caminho, qs] = path.split('?');
  for (const [m, padrao, handler] of rotas) {
    if (m !== method) continue;
    const params = corresponder(padrao, caminho);
    if (!params) continue;
    // Cópia profunda: o chamador nunca pode alterar a "base de dados" por referência.
    const resultado = handler({ params, query: new URLSearchParams(qs), body: body === undefined ? undefined : structuredClone(body) });
    return (resultado === undefined ? undefined : structuredClone(resultado)) as T;
  }
  throw new ApiError(404, `Rota inexistente: ${method} ${caminho}`);
}

// ---------- Envio de ficheiros ----------

const LIMITES = { foto: 10 * 1024 * 1024, video: 60 * 1024 * 1024, documento: 10 * 1024 * 1024, assinatura: 1024 * 1024 };
const FINALIDADES: FinalidadeAnexo[] = ['assinatura_recepcao', 'assinatura_aprovacao', 'comprovativo_aprovacao', 'assinatura_entrega'];

/** POST /processos/:id/anexos (multipart): ficheiro, tipo, finalidade?, legenda? */
export async function handleUpload<T>(path: string, form: FormData): Promise<T> {
  await latencia();
  const params = corresponder('/processos/:id/anexos', path);
  if (!params) throw new ApiError(404, `Rota inexistente: POST ${path}`);
  const u = exigir('processos.ver');
  const p = obterProcesso(params.id);
  if (!estaAtivo(p.estado)) throw new ApiError(422, 'Não é possível juntar ficheiros a um processo encerrado.');

  const ficheiro = form.get('ficheiro');
  if (!(ficheiro instanceof Blob) || ficheiro.size === 0) throw new ApiError(422, 'Nenhum ficheiro recebido.');
  const tipo = String(form.get('tipo') ?? '') as Anexo['tipo'];
  if (!(tipo in LIMITES)) throw new ApiError(422, 'Tipo de ficheiro inválido.');
  // O PHP deve verificar o tipo real com finfo, não confiar no que o navegador declara.
  const mime = ficheiro.type;
  const mimeValido =
    (tipo === 'foto' || tipo === 'assinatura') ? mime.startsWith('image/') :
    tipo === 'video' ? mime.startsWith('video/') :
    mime === 'application/pdf' || mime.startsWith('image/');
  if (!mimeValido) throw new ApiError(422, 'O formato do ficheiro não corresponde ao tipo indicado.');
  if (ficheiro.size > LIMITES[tipo]) {
    throw new ApiError(422, `Ficheiro demasiado grande (máximo ${Math.round(LIMITES[tipo] / 1024 / 1024)} MB).`);
  }
  const finalidadeBruta = form.get('finalidade');
  const finalidade = finalidadeBruta ? (String(finalidadeBruta) as FinalidadeAnexo) : undefined;
  if (finalidade && !FINALIDADES.includes(finalidade)) throw new ApiError(422, 'Finalidade inválida.');

  const id = novoId('anexo', 'an');
  await guardarFicheiro(id, ficheiro);
  const anexo: Anexo = {
    id,
    processoId: p.id,
    tipo,
    etapa: p.estado,
    finalidade,
    legenda: form.get('legenda') ? String(form.get('legenda')).slice(0, 200) : undefined,
    nome: ficheiro instanceof File ? ficheiro.name : `${tipo}-${id}`,
    url: `${PREFIXO_URL_MOCK}${id}`,
    tamanhoBytes: ficheiro.size,
    criadoEm: new Date().toISOString(),
    autorId: u.id,
  };
  db().anexos.push(anexo);
  if (finalidade === 'assinatura_recepcao') {
    p.fichaRecepcao.assinaturaAnexoId = id;
    p.fichaRecepcao.assinaturaCliente = true;
  }
  auditar(u.id, 'anexar', 'processo', p.id, `${tipo}${finalidade ? ` (${finalidade})` : ''}`);
  guardar();
  return structuredClone(anexo) as T;
}
