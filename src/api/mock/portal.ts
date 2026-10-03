// Portal do cliente: acompanhamento e aprovação do orçamento por um link pessoal, sem conta.
//
// Regras (o PHP deve replicá-las):
// - O link é /p/{token}, com um token aleatório de 128+ bits gerado no servidor (random_bytes).
//   Renovar o link invalida o anterior. Token desconhecido → 404, sempre com a mesma mensagem.
// - O link deixa de funcionar 30 dias depois de o processo terminar (entrega ou cancelamento) → 410.
// - Limitar pedidos por IP nas rotas /portal (ex.: 30/min) para impedir a adivinhação de tokens.
// - A resposta é uma projeção própria (PortalProcesso): nada de custos, notas internas, nomes da equipa
//   nem histórico interno. Fotografias só as da viatura (nunca assinaturas nem comprovativos).
// - Aprovação: só com o processo à espera de aprovação, orçamento dentro da validade, nome de quem
//   aprova e aceitação expressa. Fica registada com o método "portal" (o PHP guarda também IP e user agent).

import { ApiError } from '../client';
import type { Metodo } from '../client';
import { db, guardar } from './db';
import type { Handler } from './contexto';
import { auditar, exigir, novoAcessoPortal, obterProcesso, texto, umDe } from './contexto';
import { aprovarOrcamento, decidirAdicional, recusarOrcamento } from './processos';
import type { AutorAcao } from './processos';
import { notificar } from './comunicacoes';
import { emDivida, recebidoProcesso, totalFaturavel } from '../../lib/calculos';
import { ESTADOS_ORDEM } from '../../types';
import type { EstadoProcesso, PortalProcesso, Processo } from '../../types';

const DIAS_APOS_FIM = 30;

function porToken(token: string): Processo {
  const p = token.length >= 16 ? db().processos.find((x) => x.portal?.token === token) : undefined;
  if (!p) throw new ApiError(404, 'Este link não é válido ou foi substituído por um mais recente. Peça um novo à oficina.');
  const fim = p.entrega?.data ?? p.cancelamento?.data;
  if (fim && Date.now() - new Date(fim).getTime() > DIAS_APOS_FIM * 86400000) {
    throw new ApiError(410, 'Este link expirou. Para consultar processos antigos, contacte a oficina.');
  }
  return p;
}

const validoAte = (p: Processo) => {
  const o = p.orcamento;
  if (!o?.enviadoEm) return undefined;
  return new Date(new Date(o.enviadoEm).getTime() + o.validadeDias * 86400000).toISOString();
};

const linhas = (o: { pecas: { descricao: string; quantidade: number; precoUnitario: number }[]; maoObra: { descricao: string; horas: number; valorHora: number }[]; taxaIva: number }) => ({
  pecas: o.pecas.map(({ descricao, quantidade, precoUnitario }) => ({ descricao, quantidade, precoUnitario })),
  maoObra: o.maoObra.map(({ descricao, horas, valorHora }) => ({ descricao, horas, valorHora })),
  taxaIva: o.taxaIva,
});

export function projetar(p: Processo): PortalProcesso {
  const base = db();
  const c = base.clientes.find((x) => x.id === p.clienteId)!;
  const v = base.viaturas.find((x) => x.id === p.viaturaId)!;
  const { empresa } = base.configuracao;
  const visivel = (e: EstadoProcesso) => ESTADOS_ORDEM.indexOf(e) >= ESTADOS_ORDEM.indexOf('aguarda_aprovacao') || p.estado === 'cancelado';
  const etapas = new Map<EstadoProcesso, string>();
  p.historico.forEach((h) => { if (h.estado && h.estado !== 'cancelado' && !etapas.has(h.estado)) etapas.set(h.estado, h.data); });
  const o = p.orcamento;
  const mostrarOrcamento = o && o.estado !== 'rascunho' && visivel(p.estado);
  const fim = validoAte(p);
  const tarefas = p.tarefas ?? [];
  const comValores = !!o && o.estado === 'aprovado';

  return {
    numero: p.numero,
    estado: p.estado,
    criadoEm: p.criadoEm,
    prazoEntrega: p.prazoEntrega,
    aguardaPecas: !!p.aguardaPecas,
    cliente: { nome: c.nome },
    viatura: { matricula: v.matricula, marca: v.marca, modelo: v.modelo },
    oficina: { nome: empresa.nome, telefone: empresa.telefone, email: empresa.email, morada: empresa.morada, iban: empresa.iban },
    queixa: p.fichaRecepcao.queixaCliente,
    etapas: [...etapas].map(([estado, data]) => ({ estado, data })),
    // O diagnóstico só se mostra com o orçamento (são aprovados juntos).
    diagnostico: p.diagnostico?.concluidoEm && mostrarOrcamento ? {
      problemas: p.diagnostico.itens.filter((i) => i.estado !== 'ok').map((i) => ({ sistema: i.sistema, gravidade: i.estado as 'atencao' | 'critico', observacao: i.observacao })),
      parecer: p.diagnostico.parecerGeral,
      concluidoEm: p.diagnostico.concluidoEm,
    } : undefined,
    orcamento: mostrarOrcamento ? {
      ...linhas(o),
      validadeDias: o.validadeDias,
      condicoesPagamento: o.condicoesPagamento,
      enviadoEm: o.enviadoEm,
      validoAte: fim,
      expirado: o.estado === 'enviado' && !!fim && Date.now() > new Date(fim).getTime(),
      estado: o.estado,
      descontoPct: o.desconto?.estado === 'aprovado' ? o.desconto.percentagem : undefined,
    } : undefined,
    autorizacao: p.autorizacao && { data: p.autorizacao.data, metodo: p.autorizacao.metodo, autorizadoPor: p.autorizacao.autorizadoPor },
    adicionais: (p.orcamentosAdicionais ?? []).map((a) => ({ id: a.id, justificacao: a.justificacao, criadoEm: a.criadoEm, estado: a.estado, ...linhas(a) })),
    progresso: tarefas.length && ['em_reparacao', 'controlo_qualidade'].includes(p.estado) ? { feitas: tarefas.filter((t) => t.feita).length, total: tarefas.length } : undefined,
    valores: comValores ? { total: totalFaturavel(p), pago: recebidoProcesso(p), aPagar: emDivida(p), fatura: p.fatura?.numero } : undefined,
    entregueEm: p.entrega?.data,
    canceladoEm: p.cancelamento?.data,
    fotos: base.anexos.filter((a) => a.processoId === p.id && (a.tipo === 'foto' || a.tipo === 'video') && !a.finalidade),
  };
}

/** Nome de quem decide no portal, para o histórico (o cliente não é utilizador do sistema). */
const autorCliente = (nome: string): AutorAcao => ({ id: null, nome: `${nome} (cliente, no portal)` });

function exigirAceitacao(body: any): string {
  const nome = texto(body?.nome, 'O seu nome', 3, 120);
  if (body?.decisao === 'aprovado' && body?.aceito !== true) throw new ApiError(422, 'Confirme que leu e aceita o orçamento.');
  return nome;
}

const balcao = ['rececionista', 'administrativa', 'chefe_oficina'] as const;

export const rotasPortal: [Metodo, string, Handler][] = [
  // Público: o token é a credencial.
  ['GET', '/portal/:token', ({ params }) => {
    const p = porToken(params.token);
    p.portal!.ultimoAcesso = new Date().toISOString();
    p.portal!.acessos += 1;
    guardar();
    return projetar(p);
  }],

  ['POST', '/portal/:token/aprovacao', ({ params, body }) => {
    const p = porToken(params.token);
    if (p.estado !== 'aguarda_aprovacao') throw new ApiError(422, 'Este orçamento já não está à espera de aprovação. Atualize a página.');
    const decisao = umDe(body?.decisao, ['aprovado', 'recusado'] as const, 'Decisão');
    const nome = exigirAceitacao(body);
    const fim = validoAte(p);
    if (decisao === 'aprovado' && fim && Date.now() > new Date(fim).getTime()) {
      throw new ApiError(422, 'A validade deste orçamento terminou. Contacte a oficina para o confirmar.');
    }
    const ref = `${p.numero} · ${db().viaturas.find((v) => v.id === p.viaturaId)?.matricula}`;
    if (decisao === 'recusado') {
      recusarOrcamento(p, autorCliente(nome), texto(body?.motivo, 'Motivo', 3, 300));
      notificar({ perfis: [...balcao] }, 'Orçamento recusado no portal', `${ref} — ${nome}: ${p.orcamento!.motivoRecusa}`, `/processos/${p.id}`);
    } else {
      aprovarOrcamento(p, autorCliente(nome), { metodo: 'portal', autorizadoPor: nome });
      notificar({ perfis: ['rececionista', 'administrativa'] }, 'Orçamento aprovado no portal', `${ref} — aprovado por ${nome}.`, `/processos/${p.id}`);
    }
    auditar(null, `portal_${decisao}`, 'processo', p.id, nome);
    guardar();
    return projetar(p);
  }],

  ['POST', '/portal/:token/adicionais/:aid', ({ params, body }) => {
    const p = porToken(params.token);
    if (p.estado !== 'em_reparacao') throw new ApiError(422, 'Este pedido já não está à espera de decisão. Atualize a página.');
    const a = (p.orcamentosAdicionais ?? []).find((x) => x.id === params.aid);
    if (!a) throw new ApiError(404, 'Pedido não encontrado.');
    if (a.estado !== 'enviado') throw new ApiError(422, 'Este pedido já foi decidido. Atualize a página.');
    const decisao = umDe(body?.decisao, ['aprovado', 'recusado'] as const, 'Decisão');
    const nome = exigirAceitacao(body);
    decidirAdicional(p, a, autorCliente(nome), decisao, 'portal', nome);
    notificar({ perfis: [...balcao] }, `Trabalho adicional ${decisao} no portal`, `${p.numero} — ${a.justificacao}`, `/processos/${p.id}`);
    guardar();
    return projetar(p);
  }],

  // Equipa: gerar um link novo (o anterior deixa de funcionar).
  ['POST', '/processos/:id/portal/renovar', ({ params }) => {
    const u = exigir('mensagens.enviar');
    const p = obterProcesso(params.id);
    p.portal = novoAcessoPortal();
    auditar(u.id, 'renovar_link_portal', 'processo', p.id);
    guardar();
    return p.portal;
  }],
];
