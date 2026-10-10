// Servidor simulado: implementa no browser o mesmo contrato HTTP que o backend PHP terá de cumprir
// (rotas, códigos de erro, permissões e regras de negócio). Ver src/api/endpoints.ts.

import { ApiError } from '../client';
import type { Metodo } from '../client';
import { db, definirSessao, guardar, reporDemo, sessaoAtual } from './db';
import { auditar, exigir, novoId, numero, obterProcesso, publico, texto, utilizadorAtual } from './contexto';
import type { Handler } from './contexto';
import { rotasProcessos } from './processos';
import { rotasClientes } from './clientes';
import { rotasAgenda } from './agenda';
import { rotasStock } from './stock';
import { rotasFinanceiro } from './financeiro';
import { rotasComunicacoes } from './comunicacoes';
import { rotasPortal } from './portal';
import { rotasRelatorios } from './relatorios';
import { rotasAdministracao } from './administracao';
import { rotasSite } from './site';
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
    const u = email ? db().utilizadores.find((x) => x.email.toLowerCase() === email) : undefined;
    if (!u || u.senha !== senha || !u.ativo || u.semAcesso) {
      const n = (estado?.n ?? 0) + 1;
      tentativas.set(email, { n, ate: n >= MAX_TENTATIVAS ? Date.now() + BLOQUEIO_MS : undefined });
      auditar(u?.id ?? null, 'login_falhado', 'sessao', undefined, email);
      guardar();
      throw new ApiError(401, 'Email ou palavra-passe incorretos.');
    }
    tentativas.delete(email);
    u.ultimoAcesso = new Date().toISOString();
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
  ...rotasPortal,
  ...rotasRelatorios,
  ...rotasAdministracao,
  ...rotasSite,

  // Configuração
  ['GET', '/configuracao', () => {
    utilizadorAtual();
    return db().configuracao;
  }],
  ['PUT', '/configuracao', ({ body }) => {
    const u = exigir('definicoes.gerir');
    const nova = validarConfiguracao(body);
    db().configuracao = nova;
    auditar(u.id, 'atualizar', 'configuracao');
    guardar();
    return nova;
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

/** As definições alimentam documentos e regras de cobrança: validar tudo (o PHP faz o mesmo). */
function validarConfiguracao(b: any): Configuracao {
  const inteiro = (v: unknown, campo: string, min: number, max: number) => numero(v, campo, { min, max, inteiro: true });
  const iban = /^AO\d{2}(\s?\d){21}$/;
  const coordenadas = (Array.isArray(b?.coordenadasPagamento) ? b.coordenadasPagamento : []).map((c: any, i: number) => {
    const valor = texto(c?.iban, `Conta ${i + 1}: IBAN`, 10, 40).toUpperCase();
    if (!iban.test(valor)) throw new ApiError(422, `Conta ${i + 1}: IBAN inválido (AO + 23 algarismos).`);
    return {
      id: String(c?.id ?? '').slice(0, 40) || `cb${Date.now().toString(36)}${i}`,
      banco: texto(c?.banco, `Conta ${i + 1}: banco`, 2, 80),
      titular: texto(c?.titular, `Conta ${i + 1}: titular`, 3, 120),
      iban: valor,
      conta: c?.conta ? String(c.conta).trim().slice(0, 40) || undefined : undefined,
    };
  });
  if (coordenadas.length > 5) throw new ApiError(422, 'Máximo de 5 contas.');
  return {
    empresa: {
      nome: texto(b?.empresa?.nome, 'Nome comercial', 2, 120),
      nif: texto(b?.empresa?.nif, 'NIF', 5, 30),
      morada: texto(b?.empresa?.morada, 'Morada', 2, 200),
      telefone: texto(b?.empresa?.telefone, 'Telefone', 6, 30),
      email: texto(b?.empresa?.email, 'Email', 5, 120),
    },
    coordenadasPagamento: coordenadas,
    instrucoesPagamento: b?.instrucoesPagamento ? String(b.instrucoesPagamento).trim().slice(0, 300) || undefined : undefined,
    taxaIva: numero(b?.taxaIva, 'Taxa de IVA', { min: 0, max: 100 }),
    motivoIsencaoIva: texto(b?.motivoIsencaoIva, 'Motivo da isenção de IVA', 3, 200),
    valorHora: numero(b?.valorHora, 'Mão de obra (Kz/hora)', { min: 1 }),
    validadeOrcamentoDias: inteiro(b?.validadeOrcamentoDias, 'Validade do orçamento', 1, 90),
    condicoes: {
      pecasAceitacaoPct: numero(b?.condicoes?.pecasAceitacaoPct, 'Peças pagas na aceitação (%)', { min: 0, max: 100 }),
      maoObraAceitacaoPct: numero(b?.condicoes?.maoObraAceitacaoPct, 'Mão de obra paga na aceitação (%)', { min: 0, max: 100 }),
      parqueamentoDia: numero(b?.condicoes?.parqueamentoDia, 'Parqueamento por dia', { min: 0 }),
      diasUteisLevantamento: inteiro(b?.condicoes?.diasUteisLevantamento, 'Dias úteis para levantar', 0, 60),
    },
    garantiaPecasMeses: inteiro(b?.garantiaPecasMeses, 'Garantia de peças', 0, 120),
    garantiaMaoObraMeses: inteiro(b?.garantiaMaoObraMeses, 'Garantia de mão de obra', 0, 120),
    capacidadeDiaria: inteiro(b?.capacidadeDiaria, 'Capacidade diária', 1, 100),
    descontoMaximoPct: numero(b?.descontoMaximoPct, 'Desconto sem aprovação', { min: 0, max: 100 }),
  };
}

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
  // Com uma palavra-passe temporária, só se pode mudar a palavra-passe ou sair.
  const sessao = sessaoAtual();
  if (sessao && !caminho.startsWith('/auth/') && db().utilizadores.find((x) => x.id === sessao)?.mudarSenha) {
    throw new ApiError(403, 'Altere a palavra-passe temporária antes de continuar.');
  }
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
// Ficha de entrada e pró-forma assinadas chegam em papel: digitalizadas (foto ou PDF).
const FINALIDADES: FinalidadeAnexo[] = ['ficha_entrada', 'comprovativo_aprovacao', 'assinatura_entrega'];

/** POST /processos/:id/anexos (multipart): ficheiro, tipo, finalidade?, legenda? */
export async function handleUpload<T>(path: string, form: FormData): Promise<T> {
  await latencia();
  if (path === '/site/imagens') return enviarImagemSite(form) as Promise<T>;
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
  auditar(u.id, 'anexar', 'processo', p.id, `${tipo}${finalidade ? ` (${finalidade})` : ''}`);
  guardar();
  return structuredClone(anexo) as T;
}

/** POST /site/imagens (multipart): ficheiro, alt. Só imagens, até 5 MB. No PHP: pasta pública /media/site. */
async function enviarImagemSite(form: FormData) {
  const u = exigir('site.gerir');
  const ficheiro = form.get('ficheiro');
  if (!(ficheiro instanceof Blob) || ficheiro.size === 0) throw new ApiError(422, 'Nenhum ficheiro recebido.');
  if (!ficheiro.type.startsWith('image/')) throw new ApiError(422, 'Só são aceites imagens.');
  if (ficheiro.size > 5 * 1024 * 1024) throw new ApiError(422, 'Imagem demasiado grande (máximo 5 MB).');
  const id = novoId('anexo', 'site');
  await guardarFicheiro(id, ficheiro);
  auditar(u.id, 'enviar_imagem', 'site', id);
  guardar();
  return { url: `${PREFIXO_URL_MOCK}${id}`, alt: String(form.get('alt') ?? '').slice(0, 160) };
}
