// Comunicações: modelos de mensagem, registo de mensagens, clientes por avisar e notificações internas.
//
// Regras (o PHP deve replicá-las):
// - Mensagens a clientes exigem consentimento (Lei 22/11 de Proteção de Dados). Respostas recebidas registam-se sempre.
// - O destino (telefone/email) vem sempre da ficha do cliente ou da marcação, nunca do pedido.
// - Email: o servidor envia (SMTP da Hostinger) e regista 'enviada', ou 'falhou' com o erro devolvido.
// - WhatsApp, fase A: o operador envia pelo seu WhatsApp (link wa.me) e o sistema regista 'registada'.
//   Na fase B (API oficial do WhatsApp Business), o servidor envia e atualiza para entregue/lida por webhook.
// - Mensagens nunca se apagam nem se editam.
// - Notificações internas vão para utilizadores ou perfis; quem provocou o evento não é notificado.

import { ApiError } from '../client';
import type { Metodo } from '../client';
import { db, guardar } from './db';
import type { NotificacaoInterna } from './seed';
import { auditar, exigir, novoId, obterProcesso, registarHistorico, texto, umDe, utilizadorAtual } from './contexto';
import type { Handler } from './contexto';
import { diaLocal } from './financeiro';
import { can } from '../../auth/permissions';
import { saldoEmAberto } from '../../lib/calculos';
import { MODELOS_PADRAO, variaveisDesconhecidas } from '../../lib/mensagens';
import { horaCurta } from '../../lib/datas';
import { CANAL_LABEL, estaAtivo } from '../../types';
import type { CanalMensagem, ComunicacaoPendente, EstadoProcesso, Mensagem, Notificacao, Perfil, Processo } from '../../types';

const CANAIS: CanalMensagem[] = ['whatsapp', 'email'];
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ---------- Notificações internas ----------

export function notificar(
  destino: { utilizadores?: (string | undefined)[]; perfis?: Perfil[] },
  titulo: string,
  textoNotificacao: string,
  link?: string,
  autorId?: string,
) {
  const base = db();
  const utilizadores = [...new Set(destino.utilizadores?.filter((x): x is string => !!x && x !== autorId) ?? [])];
  if (utilizadores.length === 0 && !destino.perfis?.length) return;
  base.notificacoes.unshift({
    id: novoId('notificacao', 'nt'),
    data: new Date().toISOString(),
    titulo,
    texto: textoNotificacao,
    link,
    utilizadores,
    perfis: destino.perfis ?? [],
    autorId,
    lidaPor: [],
  });
  base.notificacoes = base.notificacoes.slice(0, 500);
}

const paraMim = (n: NotificacaoInterna, id: string, perfil: Perfil) =>
  n.autorId !== id && (n.utilizadores.includes(id) || n.perfis.includes(perfil));

function resumoProcesso(p: Processo) {
  const v = db().viaturas.find((x) => x.id === p.viaturaId);
  return `${p.numero} · ${v?.matricula ?? ''}`;
}

/** Avisos à equipa quando um processo muda de etapa (chamado depois de mudar o estado). */
export function notificarMudanca(p: Processo, anterior: EstadoProcesso, autorId: string) {
  const link = `/processos/${p.id}`;
  const ref = resumoProcesso(p);
  const balcao: Perfil[] = ['rececionista', 'administrativa'];
  switch (p.estado) {
    case 'orcamentacao':
      return notificar({ perfis: balcao }, 'Diagnóstico concluído', `${ref} — preparar o orçamento.`, link, autorId);
    case 'em_reparacao':
      if (anterior === 'controlo_qualidade') {
        return notificar({ utilizadores: [p.mecanicoId], perfis: ['chefe_oficina'] }, 'Controlo de qualidade reprovado', `${ref} voltou à reparação.`, link, autorId);
      }
      return notificar({ utilizadores: [p.mecanicoId], perfis: ['chefe_oficina'] }, 'Reparação aprovada pelo cliente', `${ref} — pode começar a reparação.`, link, autorId);
    case 'controlo_qualidade':
      return notificar({ perfis: ['chefe_oficina'] }, 'Pronta para controlo de qualidade', `${ref} — reparação concluída.`, link, autorId);
    case 'pronta_entrega':
      return notificar({ perfis: balcao }, 'Viatura pronta', `${ref} — avisar o cliente para levantar.`, link, autorId);
    case 'cancelado':
      return notificar({ utilizadores: [p.mecanicoId] }, 'Processo cancelado', ref, link, autorId);
  }
}

// ---------- Mensagens ----------

function modelos() {
  return db().modelos;
}

function validarMensagem(body: any, autorId: string): { mensagem: Mensagem; processo?: Processo } {
  const base = db();
  const canal = umDe(body?.canal, CANAIS, 'Canal');
  const direcao = umDe(body?.direcao ?? 'saida', ['saida', 'entrada'] as const, 'Direção');
  const processo = body?.processoId ? obterProcesso(String(body.processoId)) : undefined;
  const marcacao = body?.marcacaoId ? base.marcacoes.find((m) => m.id === body.marcacaoId) : undefined;
  if (body?.marcacaoId && !marcacao) throw new ApiError(404, 'Marcação não encontrada.');

  const clienteId = processo?.clienteId ?? marcacao?.clienteId ?? (body?.clienteId ? String(body.clienteId) : undefined);
  if (body?.clienteId && clienteId !== body.clienteId) throw new ApiError(422, 'O cliente não corresponde ao processo ou marcação indicados.');
  const cliente = clienteId ? base.clientes.find((c) => c.id === clienteId) : undefined;
  if (clienteId && !cliente) throw new ApiError(404, 'Cliente não encontrado.');
  if (!cliente && !marcacao) throw new ApiError(422, 'Indique o cliente, o processo ou a marcação.');

  if (direcao === 'saida' && cliente && !cliente.consentimentoMensagens) {
    throw new ApiError(422, 'Este cliente não autorizou o envio de mensagens. Registe o consentimento na ficha do cliente.');
  }
  const nome = cliente?.nome ?? marcacao!.nome;
  const destino = canal === 'email' ? cliente?.email ?? '' : cliente?.telefone ?? marcacao!.telefone;
  if (canal === 'email' && !EMAIL_VALIDO.test(destino)) throw new ApiError(422, 'O cliente não tem um email válido registado.');
  if (canal === 'whatsapp' && destino.replace(/\D/g, '').length < 9) throw new ApiError(422, 'O telefone do cliente não é válido para WhatsApp.');

  const modelo = body?.modelo ? umDe(body.modelo, modelos().map((m) => m.chave), 'Modelo') : undefined;
  const mensagem: Mensagem = {
    id: novoId('mensagem', 'msg'),
    data: new Date().toISOString(),
    canal,
    direcao,
    estado: direcao === 'entrada' ? 'recebida' : canal === 'whatsapp' ? 'registada' : 'enviada',
    clienteId,
    processoId: processo?.id,
    marcacaoId: marcacao?.id,
    nome,
    destino,
    assunto: canal === 'email' && direcao === 'saida' ? texto(body?.assunto, 'Assunto', 1, 150) : undefined,
    texto: texto(body?.texto, 'Mensagem', 1, 4000),
    modelo: direcao === 'saida' ? modelo : undefined,
    autorId,
  };
  return { mensagem, processo };
}

// ---------- Clientes por avisar ----------

/** Momento em que o processo entrou na etapa atual. */
function entradaNaEtapa(p: Processo): string {
  const ev = [...p.historico].reverse().find((h) => h.estado === p.estado);
  return ev?.data ?? p.criadoEm;
}

function pendentes(comValores: boolean): ComunicacaoPendente[] {
  const base = db();
  const saidas = base.mensagens.filter((m) => m.direcao === 'saida' && m.estado !== 'falhou');
  const avisado = (desde: string, f: (m: Mensagem) => boolean) => saidas.some((m) => f(m) && m.data >= desde);
  const lista: ComunicacaoPendente[] = [];

  const MOMENTOS: Partial<Record<EstadoProcesso, { motivo: ComunicacaoPendente['motivo']; titulo: string }>> = {
    recepcao: { motivo: 'rececao', titulo: 'Confirmar a receção da viatura' },
    aguarda_aprovacao: { motivo: 'orcamento', titulo: 'Enviar diagnóstico e orçamento' },
    pronta_entrega: { motivo: 'pronta', titulo: 'Avisar que a viatura está pronta' },
  };
  for (const p of base.processos.filter((x) => estaAtivo(x.estado))) {
    const c = base.clientes.find((x) => x.id === p.clienteId)!;
    const v = base.viaturas.find((x) => x.id === p.viaturaId);
    const contacto = { clienteId: c.id, processoId: p.id, nome: c.nome, telefone: c.telefone, email: c.email, consentimento: c.consentimentoMensagens, matricula: v?.matricula };
    const momento = MOMENTOS[p.estado];
    if (momento) {
      const desde = entradaNaEtapa(p);
      if (!avisado(desde, (m) => m.processoId === p.id)) {
        lista.push({ id: `${momento.motivo}-${p.id}`, motivo: momento.motivo, modelo: momento.motivo, titulo: momento.titulo, desde, ...contacto });
      }
    }
    const adicional = p.orcamentosAdicionais?.find((a) => a.estado === 'enviado');
    if (adicional && !avisado(adicional.criadoEm, (m) => m.processoId === p.id)) {
      lista.push({ id: `adicional-${adicional.id}`, motivo: 'adicional', modelo: 'adicional', titulo: 'Pedir aprovação do trabalho adicional', desde: adicional.criadoEm, ...contacto });
    }
  }

  // Marcações por confirmar até ao fim do próximo dia útil (ao sábado, inclui segunda-feira).
  const agora = new Date();
  const proximo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
  if (proximo.getDay() === 0) proximo.setDate(proximo.getDate() + 1);
  const limite = new Date(proximo.getFullYear(), proximo.getMonth(), proximo.getDate() + 1).toISOString();
  const hoje = diaLocal(agora);
  const amanha = diaLocal(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1));
  const quando = (iso: string) => {
    const dia = diaLocal(iso);
    return dia === hoje ? 'hoje' : dia === amanha ? 'amanhã' : new Date(iso).toLocaleDateString('pt-PT', { weekday: 'long' });
  };
  for (const m of base.marcacoes) {
    if (m.estado !== 'agendada' || m.data < agora.toISOString() || m.data >= limite) continue;
    if (avisado(m.criadoEm, (x) => x.marcacaoId === m.id)) continue;
    const c = m.clienteId ? base.clientes.find((x) => x.id === m.clienteId) : undefined;
    lista.push({
      id: `marcacao-${m.id}`, motivo: 'marcacao', modelo: 'marcacao',
      titulo: `Lembrar a marcação de ${quando(m.data)} às ${horaCurta(m.data)}`,
      desde: m.criadoEm, clienteId: c?.id, marcacaoId: m.id, nome: c?.nome ?? m.nome, telefone: c?.telefone ?? m.telefone, email: c?.email,
      consentimento: c ? c.consentimentoMensagens : true, matricula: m.matricula,
    });
  }

  // Faturas por pagar há mais de 30 dias, sem lembrete na última semana.
  const semana = new Date(Date.now() - 7 * 86400000).toISOString();
  const porCliente = new Map<string, { total: number; faturas: string[]; desde: string }>();
  for (const p of base.processos) {
    const saldo = saldoEmAberto(p.fatura);
    if (!p.fatura || saldo <= 0 || Date.now() - new Date(p.fatura.data).getTime() < 30 * 86400000) continue;
    const d = porCliente.get(p.clienteId) ?? { total: 0, faturas: [], desde: p.fatura.data };
    d.total += saldo;
    d.faturas.push(p.fatura.numero);
    if (p.fatura.data < d.desde) d.desde = p.fatura.data;
    porCliente.set(p.clienteId, d);
  }
  for (const [clienteId, d] of porCliente) {
    if (avisado(semana, (m) => m.clienteId === clienteId && m.modelo === 'divida')) continue;
    const c = base.clientes.find((x) => x.id === clienteId)!;
    lista.push({
      id: `divida-${c.id}`, motivo: 'divida', modelo: 'divida', titulo: `Lembrar pagamento em atraso (${d.faturas.length} fatura${d.faturas.length > 1 ? 's' : ''})`,
      desde: d.desde, clienteId: c.id, nome: c.nome, telefone: c.telefone, email: c.email, consentimento: c.consentimentoMensagens,
      divida: comValores ? { total: d.total, faturas: d.faturas } : undefined,
    });
  }
  return lista.sort((a, b) => a.desde.localeCompare(b.desde));
}

// ---------- Rotas ----------

export const rotasComunicacoes: [Metodo, string, Handler][] = [
  ['GET', '/modelos', () => {
    const u = utilizadorAtual();
    if (!can(u, 'mensagens.enviar') && !can(u, 'definicoes.gerir')) throw new ApiError(403, 'Não tem permissão para esta operação.');
    return modelos();
  }],

  ['PUT', '/modelos/:chave', ({ params, body }) => {
    const u = exigir('definicoes.gerir');
    const m = modelos().find((x) => x.chave === params.chave);
    if (!m) throw new ApiError(404, 'Modelo não encontrado.');
    const nome = texto(body?.nome, 'Nome', 3, 60);
    const assunto = texto(body?.assunto, 'Assunto do email', 3, 150);
    const corpo = texto(body?.texto, 'Texto', 5, 1500);
    const desconhecidas = variaveisDesconhecidas(`${assunto}\n${corpo}`);
    if (desconhecidas.length) throw new ApiError(422, `Variável desconhecida: ${desconhecidas.map((v) => `{${v}}`).join(', ')}.`);
    Object.assign(m, { nome, assunto, texto: corpo, atualizadoEm: new Date().toISOString(), atualizadoPorId: u.id });
    auditar(u.id, 'editar', 'modelo_mensagem', m.chave);
    guardar();
    return m;
  }],

  ['POST', '/modelos/:chave/repor', ({ params }) => {
    const u = exigir('definicoes.gerir');
    const i = modelos().findIndex((x) => x.chave === params.chave);
    const padrao = MODELOS_PADRAO.find((x) => x.chave === params.chave);
    if (i < 0 || !padrao) throw new ApiError(404, 'Modelo não encontrado.');
    db().modelos[i] = { ...padrao };
    auditar(u.id, 'repor', 'modelo_mensagem', padrao.chave);
    guardar();
    return db().modelos[i];
  }],

  ['GET', '/mensagens', ({ query }) => {
    exigir('mensagens.enviar');
    const f = (k: string) => query.get(k) || undefined;
    const [clienteId, processoId, marcacaoId, canal] = [f('clienteId'), f('processoId'), f('marcacaoId'), f('canal')];
    return db().mensagens
      .filter((m) => (!clienteId || m.clienteId === clienteId) && (!processoId || m.processoId === processoId)
        && (!marcacaoId || m.marcacaoId === marcacaoId) && (!canal || m.canal === canal))
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 500);
  }],

  ['POST', '/mensagens', ({ body }) => {
    const u = exigir('mensagens.enviar');
    const { mensagem, processo } = validarMensagem(body, u.id);
    db().mensagens.push(mensagem);
    if (processo) {
      const modelo = mensagem.modelo ? modelos().find((m) => m.chave === mensagem.modelo)?.nome : undefined;
      registarHistorico(
        processo, u.nome,
        mensagem.direcao === 'entrada'
          ? `Resposta do cliente por ${CANAL_LABEL[mensagem.canal]}: "${mensagem.texto.slice(0, 120)}${mensagem.texto.length > 120 ? '…' : ''}"`
          : `Mensagem ao cliente por ${CANAL_LABEL[mensagem.canal]}${modelo ? ` — ${modelo}` : ''}`,
        'nota',
      );
    }
    auditar(u.id, mensagem.direcao === 'entrada' ? 'registar_resposta' : 'enviar_mensagem', 'mensagem', mensagem.id, `${mensagem.canal} · ${mensagem.nome}`);
    guardar();
    return mensagem;
  }],

  ['GET', '/comunicacoes/pendentes', () => {
    const u = exigir('mensagens.enviar');
    return pendentes(can(u, 'valores.ver'));
  }],

  ['GET', '/notificacoes', () => {
    const u = utilizadorAtual();
    return db().notificacoes
      .filter((n) => paraMim(n, u.id, u.perfil))
      .slice(0, 50)
      .map((n): Notificacao => ({ id: n.id, data: n.data, titulo: n.titulo, texto: n.texto, link: n.link, lida: n.lidaPor.includes(u.id) }));
  }],

  // Marca como lidas as indicadas, ou todas se não vier nenhuma.
  ['POST', '/notificacoes/lidas', ({ body }) => {
    const u = utilizadorAtual();
    const ids: string[] | undefined = Array.isArray(body?.ids) ? body.ids.map(String) : undefined;
    db().notificacoes.forEach((n) => {
      if (paraMim(n, u.id, u.perfil) && (!ids || ids.includes(n.id)) && !n.lidaPor.includes(u.id)) n.lidaPor.push(u.id);
    });
    guardar();
    return undefined;
  }],
];

