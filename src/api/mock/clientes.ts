// Rotas de clientes e viaturas: criação, edição, transferência de proprietário e junção de duplicados.
// As validações aqui são partilhadas com a receção (POST /processos).

import { ApiError } from '../client';
import type { Metodo } from '../client';
import { db, guardar } from './db';
import { auditar, exigir, novoId, numero, texto } from './contexto';
import type { Handler } from './contexto';
import { estaAtivo } from '../../types';
import type { Cliente, ClienteResumo, Viatura, ViaturaResumo } from '../../types';

export const soDigitos = (s: string) => s.replace(/\D/g, '');
/** Compara telefones pelos últimos 9 dígitos (com ou sem o indicativo +244). */
export const mesmoTelefone = (a: string, b: string) => soDigitos(a).slice(-9) === soDigitos(b).slice(-9);
/** Maiúsculas, sem espaços; no formato angolano sem hífenes (LD8877CD) acrescenta-os (LD-88-77-CD). */
export const normalizarMatricula = (m: string) => {
  const limpa = m.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '');
  const partes = limpa.match(/^([A-Z]{2,3})(\d{2})(\d{2})([A-Z]{2})$/);
  return partes ? partes.slice(1).join('-') : limpa;
};
/** Chave de comparação: só letras e números (LD-88-77-CD = LD8877CD). */
const chaveMatricula = (m: string) => m.toUpperCase().replace(/[^A-Z0-9]/g, '');
const normalizarNome = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Valida os dados de um cliente. `ignorarId` permite editar sem colidir consigo próprio. */
export function validarCliente(n: any, ignorarId?: string): Omit<Cliente, 'id' | 'desde'> {
  const base = db();
  const telefone = texto(n?.telefone, 'Telefone', 9, 20);
  if (soDigitos(telefone).length < 9) throw new ApiError(422, 'Telefone: indique pelo menos 9 dígitos.');
  const outro = base.clientes.find((c) => c.id !== ignorarId && mesmoTelefone(c.telefone, telefone));
  if (outro) throw new ApiError(422, `Já existe um cliente com este telefone (${outro.nome}).`);
  const email = n?.email ? texto(n.email, 'Email', 5, 120) : undefined;
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new ApiError(422, 'Email inválido.');
  const nif = n?.nif ? texto(n.nif, 'NIF', 5, 20).toUpperCase() : undefined;
  if (nif) {
    const comNif = base.clientes.find((c) => c.id !== ignorarId && c.nif?.toUpperCase() === nif);
    if (comNif) throw new ApiError(422, `Já existe um cliente com este NIF (${comNif.nome}).`);
  }
  return {
    nome: texto(n?.nome, 'Nome', 3, 120),
    telefone,
    email,
    nif,
    morada: n?.morada ? texto(n.morada, 'Morada', 2, 200) : undefined,
    consentimentoMensagens: !!n?.consentimentoMensagens,
  };
}

export function validarViatura(v: any, ignorarId?: string): Omit<Viatura, 'id' | 'clienteId' | 'km'> {
  // Normaliza antes de validar o tamanho: "ld - 29 - 82 - gh" é uma matrícula válida.
  const matricula = normalizarMatricula(texto(v?.matricula, 'Matrícula', 4, 40));
  if (matricula.replace(/-/g, '').length < 5 || matricula.length > 15) throw new ApiError(422, 'Matrícula inválida.');
  const outra = db().viaturas.find((x) => x.id !== ignorarId && chaveMatricula(x.matricula) === chaveMatricula(matricula));
  if (outra) throw new ApiError(422, 'Já existe uma viatura com esta matrícula.');
  return {
    matricula,
    marca: texto(v?.marca, 'Marca', 2, 40),
    modelo: texto(v?.modelo, 'Modelo', 1, 60),
    ano: numero(v?.ano, 'Ano', { min: 1950, max: new Date().getFullYear() + 1, inteiro: true }),
    cor: texto(v?.cor, 'Cor', 2, 30),
    chassi: v?.chassi ? texto(v.chassi, 'Chassi', 5, 30).toUpperCase() : '',
  };
}

export function criarCliente(dados: Omit<Cliente, 'id' | 'desde'>): Cliente {
  const c: Cliente = { id: novoId('cliente', 'c'), desde: new Date().toISOString().slice(0, 10), ...dados };
  db().clientes.push(c);
  return c;
}

export function criarViatura(dados: Omit<Viatura, 'id' | 'clienteId' | 'km'>, clienteId: string, km: number): Viatura {
  const v: Viatura = { id: novoId('viatura', 'v'), clienteId, km, ...dados };
  db().viaturas.push(v);
  return v;
}

export function resumoCliente(c: Cliente): ClienteResumo {
  const base = db();
  return {
    ...c,
    nViaturas: base.viaturas.filter((v) => v.clienteId === c.id).length,
    nProcessos: base.processos.filter((p) => p.clienteId === c.id).length,
  };
}

export function resumoViatura(v: Viatura): ViaturaResumo {
  const base = db();
  const c = base.clientes.find((x) => x.id === v.clienteId)!;
  return {
    ...v,
    cliente: { id: c.id, nome: c.nome, telefone: c.telefone },
    nServicos: base.processos.filter((p) => p.viaturaId === v.id).length,
  };
}

function obterCliente(id: string) {
  const c = db().clientes.find((x) => x.id === id);
  if (!c) throw new ApiError(404, 'Cliente não encontrado.');
  return c;
}

function obterViatura(id: string) {
  const v = db().viaturas.find((x) => x.id === id);
  if (!v) throw new ApiError(404, 'Viatura não encontrada.');
  return v;
}

/** Pares de clientes que provavelmente são a mesma pessoa. */
function duplicados() {
  const lista = db().clientes;
  const pares: { a: string; b: string; motivo: string }[] = [];
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i];
      const b = lista[j];
      const motivo = mesmoTelefone(a.telefone, b.telefone)
        ? 'Mesmo telefone'
        : a.nif && b.nif && a.nif.toUpperCase() === b.nif.toUpperCase()
          ? 'Mesmo NIF'
          : normalizarNome(a.nome) === normalizarNome(b.nome)
            ? 'Mesmo nome'
            : null;
      if (motivo) pares.push({ a: a.id, b: b.id, motivo });
    }
  }
  return pares.map((p) => ({ motivo: p.motivo, clientes: [resumoCliente(obterCliente(p.a)), resumoCliente(obterCliente(p.b))] }));
}

export const rotasClientes: [Metodo, string, Handler][] = [
  ['GET', '/clientes', () => {
    exigir('clientes.ver');
    return db().clientes.map(resumoCliente);
  }],
  ['GET', '/clientes/duplicados', () => {
    exigir('clientes.fundir');
    return duplicados();
  }],
  ['GET', '/clientes/:id', ({ params }) => {
    exigir('clientes.ver');
    return obterCliente(params.id);
  }],
  ['POST', '/clientes', ({ body }) => {
    const u = exigir('clientes.editar');
    const c = criarCliente(validarCliente(body));
    auditar(u.id, 'criar', 'cliente', c.id, c.nome);
    guardar();
    return c;
  }],
  ['PUT', '/clientes/:id', ({ params, body }) => {
    const u = exigir('clientes.editar');
    const c = obterCliente(params.id);
    const dados = validarCliente(body, c.id);
    const consentimentoMudou = dados.consentimentoMensagens !== c.consentimentoMensagens;
    Object.assign(c, dados);
    auditar(u.id, 'editar', 'cliente', c.id, consentimentoMudou ? `consentimento: ${dados.consentimentoMensagens ? 'sim' : 'não'}` : undefined);
    guardar();
    return c;
  }],
  // Junta o cliente `origemId` no cliente `:id`: viaturas e processos passam para o destino; a origem é apagada.
  ['POST', '/clientes/:id/fundir', ({ params, body }) => {
    const u = exigir('clientes.fundir');
    const base = db();
    const destino = obterCliente(params.id);
    const origem = obterCliente(String(body?.origemId ?? ''));
    if (origem.id === destino.id) throw new ApiError(422, 'Escolha dois clientes diferentes.');
    let viaturas = 0;
    let processos = 0;
    base.viaturas.forEach((v) => { if (v.clienteId === origem.id) { v.clienteId = destino.id; viaturas++; } });
    base.processos.forEach((p) => { if (p.clienteId === origem.id) { p.clienteId = destino.id; processos++; } });
    // Completa dados em falta no destino com os da origem (nunca sobrescreve).
    destino.email ??= origem.email;
    destino.nif ??= origem.nif;
    destino.morada ??= origem.morada;
    if (origem.desde < destino.desde) destino.desde = origem.desde;
    base.clientes = base.clientes.filter((c) => c.id !== origem.id);
    auditar(u.id, 'fundir', 'cliente', destino.id, `${origem.nome} (${origem.id}) → ${destino.nome}: ${viaturas} viatura(s), ${processos} processo(s)`);
    guardar();
    return destino;
  }],

  ['GET', '/viaturas', ({ query }) => {
    exigir('viaturas.ver');
    const clienteId = query.get('clienteId');
    return db().viaturas.filter((v) => !clienteId || v.clienteId === clienteId).map(resumoViatura);
  }],
  ['GET', '/viaturas/:id', ({ params }) => {
    exigir('viaturas.ver');
    return resumoViatura(obterViatura(params.id));
  }],
  ['POST', '/viaturas', ({ body }) => {
    const u = exigir('clientes.editar');
    const dono = obterCliente(String(body?.clienteId ?? ''));
    const dados = validarViatura(body);
    const km = numero(body?.km ?? 0, 'Quilometragem', { min: 0, max: 2_000_000, inteiro: true });
    const v = criarViatura(dados, dono.id, km);
    auditar(u.id, 'criar', 'viatura', v.id, v.matricula);
    guardar();
    return resumoViatura(v);
  }],
  ['PUT', '/viaturas/:id', ({ params, body }) => {
    const u = exigir('clientes.editar');
    const v = obterViatura(params.id);
    Object.assign(v, validarViatura(body, v.id));
    auditar(u.id, 'editar', 'viatura', v.id, v.matricula);
    guardar();
    return resumoViatura(v);
  }],
  // Venda da viatura: muda o proprietário; o histórico de serviços fica com a viatura.
  ['PATCH', '/viaturas/:id/proprietario', ({ params, body }) => {
    const u = exigir('clientes.editar');
    const v = obterViatura(params.id);
    const novo = obterCliente(String(body?.clienteId ?? ''));
    if (novo.id === v.clienteId) throw new ApiError(422, 'A viatura já pertence a este cliente.');
    const emCurso = db().processos.find((p) => p.viaturaId === v.id && estaAtivo(p.estado));
    if (emCurso) throw new ApiError(422, `Não é possível transferir com um processo em curso (${emCurso.numero}).`);
    const anterior = v.clienteId;
    v.clienteId = novo.id;
    auditar(u.id, 'transferir', 'viatura', v.id, `${anterior} → ${novo.id}`);
    guardar();
    return resumoViatura(v);
  }],
];
