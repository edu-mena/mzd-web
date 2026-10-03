// Rotas da agenda (marcações de entrada na oficina).

import { ApiError } from '../client';
import type { Metodo } from '../client';
import { db, guardar } from './db';
import { auditar, exigir, novoId, texto, umDe } from './contexto';
import type { Handler } from './contexto';
import { normalizarMatricula, soDigitos } from './clientes';
import type { EstadoMarcacao, Marcacao, TipoMarcacao } from '../../types';

const TIPOS: TipoMarcacao[] = ['revisao', 'diagnostico', 'reparacao', 'outro'];
const ABERTA: EstadoMarcacao[] = ['agendada', 'confirmada'];
/** Transições permitidas manualmente. "chegou" só acontece ao abrir o processo na receção. */
const TRANSICOES: Partial<Record<EstadoMarcacao, EstadoMarcacao[]>> = {
  agendada: ['confirmada', 'cancelada', 'faltou'],
  confirmada: ['agendada', 'cancelada', 'faltou'],
  faltou: ['agendada'],
  cancelada: ['agendada'],
};

const diaDe = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Marcações que ocupam capacidade num dia (as canceladas e as faltas não contam). */
export function ocupacaoDia(dia: string, ignorarId?: string) {
  return db().marcacoes.filter((m) => m.id !== ignorarId && diaDe(m.data) === dia && m.estado !== 'cancelada' && m.estado !== 'faltou').length;
}

function obterMarcacao(id: string) {
  const m = db().marcacoes.find((x) => x.id === id);
  if (!m) throw new ApiError(404, 'Marcação não encontrada.');
  return m;
}

/** Valida dados de uma marcação (criação e edição). Lança 409 se o dia está cheio e não se pediu para forçar. */
function validar(body: any, ignorarId?: string): Omit<Marcacao, 'id' | 'estado' | 'criadoPorId' | 'criadoEm' | 'processoId'> {
  const base = db();
  const data = new Date(String(body?.data ?? ''));
  if (Number.isNaN(data.getTime())) throw new ApiError(422, 'Indique a data e a hora.');
  if (!ignorarId && data.getTime() < Date.now() - 60 * 60 * 1000) throw new ApiError(422, 'Não é possível marcar no passado.');
  if (data.getDay() === 0) throw new ApiError(422, 'A oficina está fechada ao domingo.');
  const minutos = data.getHours() * 60 + data.getMinutes();
  const fecho = data.getDay() === 6 ? 13 * 60 : 18 * 60;
  if (minutos < 7 * 60 + 30 || minutos > fecho) {
    throw new ApiError(422, data.getDay() === 6 ? 'Ao sábado as entradas são entre as 07:30 e as 13:00.' : 'As entradas são entre as 07:30 e as 18:00.');
  }

  let clienteId: string | undefined;
  let viaturaId: string | undefined;
  let nome: string;
  let telefone: string;
  let matricula: string | undefined;
  if (body?.viaturaId) {
    const v = base.viaturas.find((x) => x.id === body.viaturaId);
    if (!v) throw new ApiError(422, 'Viatura não encontrada.');
    const c = base.clientes.find((x) => x.id === v.clienteId)!;
    viaturaId = v.id;
    clienteId = c.id;
    nome = c.nome;
    telefone = c.telefone;
    matricula = v.matricula;
    const outra = base.marcacoes.find((m) => m.id !== ignorarId && m.viaturaId === v.id && ABERTA.includes(m.estado));
    if (outra) throw new ApiError(422, `Esta viatura já tem uma marcação em aberto (${new Date(outra.data).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}).`);
  } else {
    nome = texto(body?.nome, 'Nome', 3, 120);
    telefone = texto(body?.telefone, 'Telefone', 9, 20);
    if (soDigitos(telefone).length < 9) throw new ApiError(422, 'Telefone: indique pelo menos 9 dígitos.');
    matricula = body?.matricula ? normalizarMatricula(String(body.matricula)) || undefined : undefined;
  }

  const dia = diaDe(data.toISOString());
  const ocupadas = ocupacaoDia(dia, ignorarId);
  const capacidade = base.configuracao.capacidadeDiaria;
  if (ocupadas >= capacidade && !body?.forcar) {
    throw new ApiError(409, `O dia já tem ${ocupadas} marcações para uma capacidade de ${capacidade}.`);
  }

  return {
    data: data.toISOString(),
    tipo: umDe(body?.tipo, TIPOS, 'Tipo de serviço'),
    clienteId,
    viaturaId,
    nome,
    telefone,
    matricula,
    notas: body?.notas ? String(body.notas).trim().slice(0, 500) || undefined : undefined,
  };
}

export const rotasAgenda: [Metodo, string, Handler][] = [
  ['GET', '/marcacoes', ({ query }) => {
    exigir('agenda.ver');
    const de = query.get('de');
    const ate = query.get('ate');
    return db().marcacoes
      .filter((m) => (!de || diaDe(m.data) >= de) && (!ate || diaDe(m.data) <= ate))
      .sort((a, b) => a.data.localeCompare(b.data));
  }],
  ['GET', '/marcacoes/:id', ({ params }) => {
    exigir('agenda.ver');
    return obterMarcacao(params.id);
  }],
  ['POST', '/marcacoes', ({ body }) => {
    const u = exigir('agenda.gerir');
    const m: Marcacao = {
      id: novoId('marcacao', 'm'),
      ...validar(body),
      estado: 'agendada',
      criadoPorId: u.id,
      criadoEm: new Date().toISOString(),
    };
    db().marcacoes.push(m);
    auditar(u.id, 'criar', 'marcacao', m.id, `${m.nome} · ${m.data}${body?.forcar ? ' (acima da capacidade)' : ''}`);
    guardar();
    return m;
  }],
  ['PUT', '/marcacoes/:id', ({ params, body }) => {
    const u = exigir('agenda.gerir');
    const m = obterMarcacao(params.id);
    if (!ABERTA.includes(m.estado)) throw new ApiError(422, 'Só é possível alterar marcações agendadas ou confirmadas.');
    Object.assign(m, validar(body, m.id));
    auditar(u.id, 'editar', 'marcacao', m.id);
    guardar();
    return m;
  }],
  ['PATCH', '/marcacoes/:id/estado', ({ params, body }) => {
    const u = exigir('agenda.gerir');
    const m = obterMarcacao(params.id);
    const novo = umDe(body?.estado, ['agendada', 'confirmada', 'faltou', 'cancelada'] as const, 'Estado');
    if (!(TRANSICOES[m.estado] ?? []).includes(novo)) throw new ApiError(422, `Não é possível passar de "${m.estado}" para "${novo}".`);
    if (novo === 'faltou' && new Date(m.data).getTime() > Date.now()) throw new ApiError(422, 'Só pode marcar falta depois da hora marcada.');
    if (novo === 'agendada' && (m.estado === 'cancelada' || m.estado === 'faltou') && new Date(m.data).getTime() < Date.now()) {
      throw new ApiError(422, 'A data já passou. Crie uma nova marcação.');
    }
    m.estado = novo;
    auditar(u.id, 'estado_marcacao', 'marcacao', m.id, novo);
    guardar();
    return m;
  }],
];

/** Usado pela receção: a marcação passa a "chegou" e fica ligada ao processo aberto. */
export function validarMarcacaoParaRececao(id: unknown): Marcacao | undefined {
  if (!id) return undefined;
  const m = obterMarcacao(String(id));
  if (!ABERTA.includes(m.estado)) throw new ApiError(422, 'Esta marcação já não está em aberto.');
  return m;
}
