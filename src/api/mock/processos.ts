// Rotas e regras de negócio do ciclo do processo (receção → entrega).
// Implementação de referência: o backend PHP deve aplicar exatamente as mesmas validações e transições.

import { ApiError } from '../client';
import type { Metodo } from '../client';
import { db, guardar } from './db';
import type { UtilizadorComSenha } from './seed';
import {
  auditar, detalhar, exigir, exigirEstado, novoAcessoPortal, novoId, numero, obterProcesso, registarHistorico, texto, umDe,
} from './contexto';
import type { Handler } from './contexto';
import { criarCliente, criarViatura, validarCliente, validarViatura } from './clientes';
import { validarMarcacaoParaRececao } from './agenda';
import { movimentar, obterPeca, verificarFaltas } from './stock';
import { avaliarDesconto, exigirCaixaAberta, proximoRecibo } from './financeiro';
import { notificar, notificarMudanca } from './comunicacoes';
import { can, PERMISSAO_ETAPA } from '../../auth/permissions';
import { calcularTotais, faturaPaga, recebidoProcesso, saldoEmAberto, totalFaturavel } from '../../lib/calculos';
import { ESTADOS_ORDEM, ESTADO_LABEL, METODO_APROVACAO_LABEL, estaAtivo } from '../../types';
import type {
  Autorizacao, OrcamentoAdicional,
  Cliente, FinalidadeAnexo, FormaPagamento, ItemOrcamentoMaoObra, ItemOrcamentoPeca, MetodoAprovacao, Pagamento, Processo, Tarefa, Viatura,
} from '../../types';

const METODOS: MetodoAprovacao[] = ['presencial', 'email', 'whatsapp', 'telefone', 'portal'];
const FORMAS: FormaPagamento[] = ['numerario', 'transferencia', 'tpa', 'multicaixa'];

// ---------- Auxiliares ----------


function validarLinhasPecas(linhas: unknown): ItemOrcamentoPeca[] {
  if (!Array.isArray(linhas)) return [];
  return linhas.map((l, i) => ({
    pecaId: l?.pecaId ? String(l.pecaId) : undefined,
    descricao: texto(l?.descricao, `Peça ${i + 1}: descrição`, 2, 200),
    quantidade: numero(l?.quantidade, `Peça ${i + 1}: quantidade`, { min: 1, max: 999, inteiro: true }),
    precoUnitario: numero(l?.precoUnitario, `Peça ${i + 1}: preço`, { min: 0 }),
  }));
}

function validarLinhasMaoObra(linhas: unknown): ItemOrcamentoMaoObra[] {
  if (!Array.isArray(linhas)) return [];
  return linhas.map((l, i) => ({
    descricao: texto(l?.descricao, `Mão de obra ${i + 1}: descrição`, 2, 200),
    horas: numero(l?.horas, `Mão de obra ${i + 1}: horas`, { min: 0.25, max: 500 }),
    valorHora: numero(l?.valorHora, `Mão de obra ${i + 1}: valor/hora`, { min: 1 }),
  }));
}

function gerarTarefas(pecas: ItemOrcamentoPeca[], maoObra: ItemOrcamentoMaoObra[], adicionalId?: string): Tarefa[] {
  return [
    ...maoObra.map((m) => ({ id: novoId('tarefa', 't'), descricao: m.descricao, origem: 'mao_obra' as const, adicionalId, feita: false })),
    ...pecas.map((p) => ({
      id: novoId('tarefa', 't'),
      descricao: `Montar ${p.descricao}${p.quantidade > 1 ? ` (×${p.quantidade})` : ''}`,
      origem: 'peca' as const,
      // Peças do catálogo ficam reservadas e dão baixa no stock quando a tarefa é feita.
      pecaId: p.pecaId,
      quantidade: p.quantidade,
      adicionalId,
      feita: false,
    })),
  ];
}

/** Confirma que um anexo existe, pertence ao processo e tem a finalidade indicada. */
function anexoValido(p: Processo, id: unknown, finalidade: FinalidadeAnexo, mensagem: string): string {
  const a = db().anexos.find((x) => x.id === id && x.processoId === p.id && x.finalidade === finalidade);
  if (!a) throw new ApiError(422, mensagem);
  return a.id;
}

function cronometroAtivo(p: Processo) {
  return (p.registosTempo ?? []).find((r) => !r.fim);
}

/** O mecânico só trabalha nos processos que lhe estão atribuídos; a chefia trabalha em qualquer um. */
function exigirMecanicoDoProcesso(p: Processo, u: UtilizadorComSenha) {
  if (u.perfil === 'mecanico' && p.mecanicoId !== u.id) {
    throw new ApiError(403, 'Este processo está atribuído a outro mecânico.');
  }
}

function emitirFatura(p: Processo) {
  const base = db();
  const numeroFatura = `FT-${new Date().getFullYear()}-${novoId('fatura', '')}`;
  p.fatura = {
    numero: numeroFatura,
    data: new Date().toISOString(),
    valorTotal: totalFaturavel(p),
    pagamentos: [...(p.adiantamentos ?? [])],
  };
  p.adiantamentos = [];
  p.garantias = [
    { item: 'Peças instaladas', tipo: 'peca', prazoMeses: base.configuracao.garantiaPecasMeses },
    { item: 'Mão de obra', tipo: 'mao_obra', prazoMeses: base.configuracao.garantiaMaoObraMeses },
  ];
}

/** Quem faz a ação: um utilizador da equipa ou o cliente no portal (id nulo). */
export interface AutorAcao { id: string | null; nome: string }

function mudarEstado(p: Processo, u: AutorAcao, proximo: Processo['estado'], descricao?: string) {
  const anterior = p.estado;
  p.estado = proximo;
  registarHistorico(p, u.nome, descricao ?? `Processo avançou para "${ESTADO_LABEL[proximo]}"`, 'estado', proximo);
  auditar(u.id, 'mudar_estado', 'processo', p.id, proximo);
  notificarMudanca(p, anterior, u.id ?? undefined);
}

// ---------- Decisões do cliente (registadas na oficina ou no portal) ----------

/** Aprovação do diagnóstico + orçamento: gera as tarefas e passa à reparação. Validar tudo antes de chamar. */
export function aprovarOrcamento(p: Processo, autor: AutorAcao, autorizacao: Omit<Autorizacao, 'valorTotal' | 'data'>) {
  p.autorizacao = { ...autorizacao, valorTotal: calcularTotais(p.orcamento).total, data: new Date().toISOString() };
  p.orcamento!.estado = 'aprovado';
  p.tarefas = gerarTarefas(p.orcamento!.pecas, p.orcamento!.maoObra);
  mudarEstado(p, autor, 'em_reparacao', `Aprovado pelo cliente (${METODO_APROVACAO_LABEL[autorizacao.metodo].toLowerCase()}) — reparação iniciada`);
  // Só depois de passar a "em reparação" as peças contam como reservadas.
  verificarFaltas(p, autor.nome);
}

/** Recusa do orçamento: o processo é cancelado. */
export function recusarOrcamento(p: Processo, autor: AutorAcao, motivo: string) {
  p.orcamento!.estado = 'recusado';
  p.orcamento!.motivoRecusa = motivo;
  p.cancelamento = { motivo: `Orçamento recusado: ${motivo}`, data: new Date().toISOString(), autorId: autor.id ?? undefined, estadoAnterior: 'aguarda_aprovacao' };
  p.estado = 'cancelado';
  registarHistorico(p, autor.nome, `Orçamento recusado pelo cliente (${motivo}). Processo cancelado.`, 'cancelamento', 'cancelado');
  auditar(autor.id, 'recusa_cliente', 'processo', p.id, motivo);
  notificarMudanca(p, 'aguarda_aprovacao', autor.id ?? undefined);
}

export function decidirAdicional(p: Processo, a: OrcamentoAdicional, autor: AutorAcao, decisao: 'aprovado' | 'recusado', metodo: MetodoAprovacao, autorizadoPor: string) {
  a.estado = decisao;
  a.decisao = { metodo, data: new Date().toISOString(), autorizadoPor };
  if (decisao === 'aprovado') {
    p.tarefas = [...(p.tarefas ?? []), ...gerarTarefas(a.pecas, a.maoObra, a.id)];
    verificarFaltas(p, autor.nome);
  }
  registarHistorico(p, autor.nome, `Trabalho adicional ${decisao} pelo cliente`, decisao === 'aprovado' ? 'nota' : 'rejeicao');
  auditar(autor.id, `adicional_${decisao}`, 'processo', p.id, metodo);
  notificar({ utilizadores: [p.mecanicoId] }, `Trabalho adicional ${decisao}`, `${p.numero} — ${a.justificacao}`, `/processos/${p.id}`, autor.id ?? undefined);
}

/** Regras para sair de cada etapa pelo botão "Avançar". Devolve a mensagem de erro ou null. */
function bloqueioAvanco(p: Processo): string | null {
  switch (p.estado) {
    case 'recepcao':
      return p.mecanicoId ? null : 'Atribua um mecânico antes de iniciar o diagnóstico.';
    case 'diagnostico':
      return p.diagnostico?.concluidoEm ? null : 'O diagnóstico tem de estar concluído antes de passar à orçamentação.';
    case 'orcamentacao':
      if (!p.orcamento || p.orcamento.pecas.length + p.orcamento.maoObra.length === 0) return 'O orçamento tem de ter pelo menos uma linha antes de ser enviado ao cliente.';
      if (p.orcamento.desconto?.estado === 'pendente') return `O desconto de ${p.orcamento.desconto.percentagem}% aguarda aprovação da Direção.`;
      if (p.orcamento.desconto?.estado === 'recusado') return 'O desconto foi recusado pela Direção — retire-o ou ajuste-o no orçamento.';
      return null;
    case 'aguarda_aprovacao':
      return p.autorizacao ? null : 'É necessário registar a aprovação do cliente (diagnóstico e orçamento) antes de iniciar a reparação.';
    case 'em_reparacao': {
      if (p.aguardaPecas) return 'A reparação está parada à espera de peças.';
      const pendentes = (p.tarefas ?? []).filter((t) => !t.feita).length;
      if (pendentes) return `Ainda há ${pendentes} tarefa(s) de reparação por concluir.`;
      if (cronometroAtivo(p)) return 'Há um cronómetro de trabalho a contar. Pare-o antes de concluir a reparação.';
      if ((p.orcamentosAdicionais ?? []).some((a) => a.estado === 'enviado')) return 'Há um trabalho adicional à espera da decisão do cliente.';
      return null;
    }
    case 'controlo_qualidade':
      return p.checklistQualidade?.aprovado ? null : 'O controlo de qualidade tem de estar aprovado antes de a viatura ficar pronta.';
    case 'pronta_entrega':
      return faturaPaga(p.fatura) ? 'Registe a entrega (quilometragem, combustível e assinatura do cliente).' : 'A fatura tem de estar totalmente paga antes da entrega.';
    default:
      return 'Este processo já não pode avançar.';
  }
}

function exigirEtapa(p: Processo, u: UtilizadorComSenha) {
  const perm = PERMISSAO_ETAPA[p.estado];
  if (!perm || !can(u, perm)) throw new ApiError(403, `O seu perfil não pode concluir a etapa "${ESTADO_LABEL[p.estado]}".`);
}

function guardarEDetalhar(p: Processo, u: UtilizadorComSenha) {
  guardar();
  return detalhar(p, u);
}

// ---------- Rotas ----------

export const rotasProcessos: [Metodo, string, Handler][] = [
  ['GET', '/processos', ({ query }) => {
    const u = exigir('processos.ver');
    const clienteId = query.get('clienteId');
    const viaturaId = query.get('viaturaId');
    return db()
      .processos.filter((p) => (!clienteId || p.clienteId === clienteId) && (!viaturaId || p.viaturaId === viaturaId))
      .map((p) => detalhar(p, u));
  }],

  ['GET', '/processos/:id', ({ params }) => detalhar(obterProcesso(params.id), exigir('processos.ver'))],

  // Receção: abre o processo, com cliente e viatura existentes ou novos.
  ['POST', '/processos', ({ body }) => {
    const u = exigir('processos.criar');
    const base = db();
    const agora = new Date().toISOString();

    // 1) Validar tudo antes de gravar seja o que for (no PHP: dentro de uma transação).
    const marcacao = validarMarcacaoParaRececao(body?.marcacaoId);
    let cliente: Cliente | undefined;
    let dadosCliente: ReturnType<typeof validarCliente> | undefined;
    if (body?.clienteId) {
      cliente = base.clientes.find((c) => c.id === body.clienteId);
      if (!cliente) throw new ApiError(422, 'Cliente não encontrado.');
    } else {
      dadosCliente = validarCliente(body?.novoCliente);
    }

    const ficha = body?.ficha ?? {};
    const km = numero(ficha.km, 'Quilometragem', { min: 0, max: 2_000_000, inteiro: true });

    let viatura: Viatura | undefined;
    let dadosViatura: ReturnType<typeof validarViatura> | undefined;
    if (body?.viaturaId) {
      viatura = base.viaturas.find((v) => v.id === body.viaturaId);
      if (!viatura) throw new ApiError(422, 'Viatura não encontrada.');
      if (!cliente || viatura.clienteId !== cliente.id) throw new ApiError(422, 'A viatura selecionada pertence a outro cliente.');
      const emCurso = base.processos.find((p) => p.viaturaId === viatura!.id && estaAtivo(p.estado));
      if (emCurso) throw new ApiError(422, `Esta viatura já tem um processo em curso (${emCurso.numero}).`);
      if (km < viatura.km) throw new ApiError(422, `A quilometragem não pode ser inferior à última registada (${viatura.km.toLocaleString('pt-PT')} km).`);
    } else {
      dadosViatura = validarViatura(body?.novaViatura);
    }

    const prazo = new Date(String(body?.prazoEntrega ?? ''));
    if (Number.isNaN(prazo.getTime()) || prazo.getTime() < Date.now() - 86400000) {
      throw new ApiError(422, 'Indique um prazo de entrega válido (hoje ou depois).');
    }

    // 2) Gravar.
    if (dadosCliente) {
      cliente = criarCliente(dadosCliente);
      auditar(u.id, 'criar', 'cliente', cliente.id, cliente.nome);
    }
    if (dadosViatura) {
      viatura = criarViatura(dadosViatura, cliente!.id, km);
      auditar(u.id, 'criar', 'viatura', viatura.id, viatura.matricula);
    } else {
      viatura!.km = km;
    }
    const clienteFinal = cliente!;
    const viaturaFinal = viatura!;

    const seq = novoId('processo', '');
    const p: Processo = {
      id: `proc${seq}`,
      numero: `OS-${new Date().getFullYear()}-${seq}`,
      clienteId: clienteFinal.id,
      viaturaId: viaturaFinal.id,
      estado: 'recepcao',
      criadoEm: agora,
      prazoEntrega: prazo.toISOString(),
      atendenteId: u.id,
      urgente: !!body?.urgente,
      fichaRecepcao: {
        queixaCliente: texto(ficha.queixaCliente, 'Queixa do cliente', 5, 1000),
        km,
        combustivel: numero(ficha.combustivel, 'Combustível', { min: 0, max: 100 }),
        bateria: umDe(ficha.bateria, ['boa', 'fraca', 'a_testar'] as const, 'Bateria'),
        danos: Array.isArray(ficha.danos)
          ? ficha.danos.slice(0, 40).map((d: any) => ({
              x: numero(d.x, 'Dano', { min: 0, max: 100 }),
              y: numero(d.y, 'Dano', { min: 0, max: 100 }),
              tipo: umDe(d.tipo, ['risco', 'mossa', 'outro'] as const, 'Tipo de dano'),
              vista: umDe(d.vista, ['topo', 'perfil'] as const, 'Vista'),
              nota: d.nota ? String(d.nota).slice(0, 200) : undefined,
            }))
          : [],
        pertences: String(ficha.pertences ?? '').trim().slice(0, 500) || 'Nenhum',
        dataHora: agora,
        assinaturaCliente: false,
        atendenteId: u.id,
      },
      portal: novoAcessoPortal(),
      historico: [],
    };
    registarHistorico(p, u.nome, marcacao ? 'Processo aberto na receção (cliente com marcação)' : 'Processo aberto na receção', 'estado', 'recepcao');
    if (marcacao) {
      marcacao.estado = 'chegou';
      marcacao.processoId = p.id;
      marcacao.clienteId ??= clienteFinal.id;
      marcacao.viaturaId ??= viaturaFinal.id;
    }
    base.processos.push(p);
    auditar(u.id, 'criar', 'processo', p.id, p.numero);
    return guardarEDetalhar(p, u);
  }],

  ['PATCH', '/processos/:id/mecanico', ({ params, body }) => {
    const u = exigir('processos.atribuir');
    const p = obterProcesso(params.id);
    exigirEstado(p, 'recepcao', 'diagnostico', 'orcamentacao', 'aguarda_aprovacao', 'em_reparacao');
    const mec = db().utilizadores.find((x) => x.id === body?.mecanicoId && x.perfil === 'mecanico' && x.ativo);
    if (!mec) throw new ApiError(422, 'Selecione um mecânico ativo.');
    const ativo = cronometroAtivo(p);
    if (ativo && ativo.mecanicoId !== mec.id) {
      const nome = db().utilizadores.find((x) => x.id === ativo.mecanicoId)?.nome;
      throw new ApiError(422, `${nome} tem o cronómetro a contar neste processo. Peça-lhe para parar antes de reatribuir.`);
    }
    const mudou = p.mecanicoId !== mec.id;
    p.mecanicoId = mec.id;
    registarHistorico(p, u.nome, `Mecânico atribuído: ${mec.nome}`, 'nota');
    if (mudou) notificar({ utilizadores: [mec.id] }, 'Viatura atribuída a si', `${p.numero} — ${p.fichaRecepcao.queixaCliente}`, `/processos/${p.id}`, u.id);
    auditar(u.id, 'atribuir_mecanico', 'processo', p.id, mec.nome);
    return guardarEDetalhar(p, u);
  }],

  ['POST', '/processos/:id/avancar', ({ params }) => {
    const u = exigir('processos.ver');
    const p = obterProcesso(params.id);
    if (!estaAtivo(p.estado)) throw new ApiError(422, 'Este processo já está encerrado.');
    exigirEtapa(p, u);
    const bloqueio = bloqueioAvanco(p);
    if (bloqueio) throw new ApiError(422, bloqueio);
    const proximo = ESTADOS_ORDEM[ESTADOS_ORDEM.indexOf(p.estado) + 1];
    if (proximo === 'aguarda_aprovacao' && p.orcamento) {
      p.orcamento.estado = 'enviado';
      p.orcamento.enviadoEm = new Date().toISOString();
    }
    mudarEstado(p, u, proximo);
    return guardarEDetalhar(p, u);
  }],

  // Diagnóstico: guardar rascunho ou concluir (concluir passa à orçamentação).
  ['PUT', '/processos/:id/diagnostico', ({ params, body }) => {
    const u = exigir('diagnostico.editar');
    const p = obterProcesso(params.id);
    exigirEstado(p, 'diagnostico');
    exigirMecanicoDoProcesso(p, u);
    const concluir = !!body?.concluir;
    const itens = (Array.isArray(body?.itens) ? body.itens : []).map((i: any) => ({
      sistema: texto(i?.sistema, 'Sistema', 2, 60),
      estado: umDe(i?.estado, ['ok', 'atencao', 'critico'] as const, `Estado de ${i?.sistema}`),
      observacao: i?.observacao ? String(i.observacao).trim().slice(0, 500) || undefined : undefined,
    }));
    const parecer = String(body?.parecerGeral ?? '').trim().slice(0, 2000);
    if (concluir) {
      if (itens.length === 0) throw new ApiError(422, 'Avalie pelo menos um sistema da viatura.');
      const semNota = itens.find((i: any) => i.estado !== 'ok' && !i.observacao);
      if (semNota) throw new ApiError(422, `Descreva o problema encontrado em "${semNota.sistema}".`);
      if (parecer.length < 10) throw new ApiError(422, 'Escreva o parecer técnico geral (mínimo 10 caracteres).');
    }
    p.diagnostico = {
      itens,
      parecerGeral: parecer,
      recomendacao: umDe(body?.recomendacao ?? 'reparar', ['reparar', 'substituir', 'ambos'] as const, 'Recomendação'),
      urgencia: umDe(body?.urgencia ?? 'medio', ['baixo', 'medio', 'alto', 'seguranca'] as const, 'Urgência'),
      mecanicoId: p.mecanicoId ?? u.id,
      concluidoEm: concluir ? new Date().toISOString() : undefined,
    };
    if (concluir) mudarEstado(p, u, 'orcamentacao', 'Diagnóstico concluído — processo passou para orçamentação');
    return guardarEDetalhar(p, u);
  }],

  ['PUT', '/processos/:id/orcamento', ({ params, body }) => {
    const u = exigir('orcamento.editar');
    if (!can(u, 'valores.ver')) throw new ApiError(403, 'Não tem permissão para ver valores.');
    const p = obterProcesso(params.id);
    exigirEstado(p, 'orcamentacao');
    const config = db().configuracao;
    const desconto = avaliarDesconto(body?.desconto, p.orcamento?.desconto, u);
    p.orcamento = {
      pecas: validarLinhasPecas(body?.pecas),
      maoObra: validarLinhasMaoObra(body?.maoObra),
      taxaIva: config.taxaIva,
      validadeDias: numero(body?.validadeDias ?? config.validadeOrcamentoDias, 'Validade', { min: 1, max: 365, inteiro: true }),
      condicoesPagamento: String(body?.condicoesPagamento ?? '').trim().slice(0, 300) || 'Pagamento na entrega',
      estado: 'rascunho',
      desconto,
    };
    if (desconto?.estado === 'pendente') {
      registarHistorico(p, u.nome, `Pedido de desconto de ${desconto.percentagem}% enviado à Direção (${desconto.motivo})`, 'nota');
      notificar({ perfis: ['direcao'] }, 'Desconto para aprovar', `${p.numero} — ${desconto.percentagem}%: ${desconto.motivo}`, `/processos/${p.id}`, u.id);
    }
    auditar(u.id, 'guardar_orcamento', 'processo', p.id, String(calcularTotais(p.orcamento).total));
    return guardarEDetalhar(p, u);
  }],

  // Decisão do cliente sobre diagnóstico + orçamento.
  ['POST', '/processos/:id/aprovacao', ({ params, body }) => {
    const u = exigir('aprovacao.registar');
    const p = obterProcesso(params.id);
    exigirEstado(p, 'aguarda_aprovacao');
    const decisao = umDe(body?.decisao, ['aprovado', 'recusado'] as const, 'Decisão');

    if (decisao === 'recusado') {
      recusarOrcamento(p, u, texto(body?.motivoRecusa, 'Motivo da recusa', 3, 300));
      return guardarEDetalhar(p, u);
    }

    const metodo = umDe(body?.metodo, METODOS, 'Método de aprovação');
    const assinaturaAnexoId = metodo === 'presencial'
      ? anexoValido(p, body?.assinaturaAnexoId, 'assinatura_aprovacao', 'Recolha a assinatura do cliente para a aprovação presencial.')
      : undefined;
    const comprovativoAnexoId = metodo === 'whatsapp' || metodo === 'email'
      ? anexoValido(p, body?.comprovativoAnexoId, 'comprovativo_aprovacao', 'Anexe o comprovativo (captura da conversa ou do email) da aprovação.')
      : undefined;
    if (metodo === 'portal') throw new ApiError(422, 'A aprovação no portal é feita pelo próprio cliente.');
    const autorizadoPor = texto(body?.autorizadoPor, 'Nome de quem autorizou', 3, 120);
    // Validar o adiantamento antes de alterar o processo.
    let adiantamento: Pagamento | undefined;
    if (body?.adiantamento && Number(body.adiantamento.valor) > 0) {
      if (!can(u, 'pagamentos.registar')) throw new ApiError(403, 'Não tem permissão para registar pagamentos.');
      adiantamento = validarPagamento(body.adiantamento, p, u);
    }
    aprovarOrcamento(p, u, { metodo, autorizadoPor, assinaturaAnexoId, comprovativoAnexoId, registadoPorId: u.id });
    if (adiantamento) p.adiantamentos = [...(p.adiantamentos ?? []), adiantamento];
    return guardarEDetalhar(p, u);
  }],

  ['PATCH', '/processos/:id/tarefas/:tid', ({ params, body }) => {
    const u = exigir('reparacao.executar');
    const p = obterProcesso(params.id);
    exigirEstado(p, 'em_reparacao');
    exigirMecanicoDoProcesso(p, u);
    const t = (p.tarefas ?? []).find((x) => x.id === params.tid);
    if (!t) throw new ApiError(404, 'Tarefa não encontrada.');
    const feita = !!body?.feita;
    if (feita === t.feita) return detalhar(p, u);
    // Montagem de peça do catálogo: baixa no stock ao marcar; devolução ao desmarcar.
    if (t.pecaId) {
      const peca = obterPeca(t.pecaId);
      const q = t.quantidade ?? 1;
      if (feita) movimentar(peca, -q, 'saida', u, { processoId: p.id, motivo: `Montada em ${p.numero}` });
      else movimentar(peca, q, 'devolucao', u, { processoId: p.id, motivo: `Tarefa desmarcada em ${p.numero}` });
    }
    t.feita = feita;
    t.feitaPorId = t.feita ? u.id : undefined;
    t.feitaEm = t.feita ? new Date().toISOString() : undefined;
    return guardarEDetalhar(p, u);
  }],

  ['PATCH', '/processos/:id/pecas', ({ params, body }) => {
    const u = exigir('reparacao.executar');
    const p = obterProcesso(params.id);
    exigirEstado(p, 'em_reparacao');
    const aguarda = !!body?.aguardaPecas;
    const nota = aguarda ? texto(body?.nota, 'Peças em falta', 3, 300) : undefined;
    p.aguardaPecas = aguarda;
    p.notaPecas = nota;
    registarHistorico(p, u.nome, aguarda ? `Reparação parada à espera de peças: ${nota}` : 'Peças recebidas — reparação retomada', 'nota');
    if (aguarda) notificar({ perfis: ['administrativa'] }, 'Peças em falta', `${p.numero} — ${nota}`, `/processos/${p.id}`, u.id);
    return guardarEDetalhar(p, u);
  }],

  ['POST', '/processos/:id/tempo', ({ params, body }) => {
    const u = exigir('reparacao.executar');
    const p = obterProcesso(params.id);
    exigirEstado(p, 'em_reparacao');
    exigirMecanicoDoProcesso(p, u);
    const acao = umDe(body?.acao, ['iniciar', 'parar'] as const, 'Ação');
    const agora = new Date().toISOString();
    // O cronómetro conta para quem trabalha: o próprio mecânico ou, se for outra pessoa a usá-lo, o técnico atribuído.
    const tecnico = u.perfil === 'mecanico' ? u.id : p.mecanicoId;
    if (!tecnico) throw new ApiError(422, 'Atribua um técnico ao processo primeiro.');
    if (acao === 'iniciar') {
      const outro = db().processos.find((x) => (x.registosTempo ?? []).some((r) => !r.fim && r.mecanicoId === tecnico));
      if (outro) throw new ApiError(422, `Já há um cronómetro ativo para este técnico em ${outro.numero}. Pare-o primeiro.`);
      p.registosTempo = [...(p.registosTempo ?? []), { id: novoId('tempo', 'r'), mecanicoId: tecnico, inicio: agora, registadoPorId: tecnico === u.id ? undefined : u.id }];
    } else {
      const ativo = (p.registosTempo ?? []).find((r) => !r.fim && r.mecanicoId === tecnico);
      if (!ativo) throw new ApiError(422, 'Não tem nenhum cronómetro ativo neste processo.');
      ativo.fim = agora;
    }
    return guardarEDetalhar(p, u);
  }],

  // Horas registadas depois do trabalho (quem regista não é quem trabalhou: ex. a receção pelos técnicos).
  ['POST', '/processos/:id/tempo/manual', ({ params, body }) => {
    const u = exigir('reparacao.executar');
    const p = obterProcesso(params.id);
    exigirEstado(p, 'em_reparacao', 'controlo_qualidade');
    exigirMecanicoDoProcesso(p, u);
    const tecnico = db().utilizadores.find((x) => x.id === (body?.mecanicoId ?? p.mecanicoId) && x.perfil === 'mecanico' && x.ativo);
    if (!tecnico) throw new ApiError(422, 'Escolha o técnico que fez o trabalho.');
    if (u.perfil === 'mecanico' && tecnico.id !== u.id) throw new ApiError(403, 'Só pode registar as suas próprias horas.');
    const horas = numero(body?.horas, 'Horas', { min: 0.25, max: 24 });
    const fim = body?.data ? new Date(String(body.data)) : new Date();
    if (Number.isNaN(fim.getTime()) || fim.getTime() > Date.now() + 60000) throw new ApiError(422, 'Data inválida.');
    if (fim.getTime() < new Date(p.criadoEm).getTime()) throw new ApiError(422, 'A data é anterior à entrada da viatura.');
    const nota = body?.nota ? String(body.nota).trim().slice(0, 200) || undefined : undefined;
    p.registosTempo = [...(p.registosTempo ?? []), {
      id: novoId('tempo', 'r'), mecanicoId: tecnico.id, inicio: new Date(fim.getTime() - horas * 3600000).toISOString(), fim: fim.toISOString(),
      registadoPorId: u.id === tecnico.id ? undefined : u.id, nota,
    }];
    registarHistorico(p, u.nome, `${horas.toLocaleString('pt-PT')} h de trabalho registadas para ${tecnico.nome}${nota ? ` (${nota})` : ''}`, 'nota');
    auditar(u.id, 'registar_horas', 'processo', p.id, `${tecnico.nome} · ${horas} h`);
    return guardarEDetalhar(p, u);
  }],

  // Trabalho adicional descoberto durante a reparação.
  ['POST', '/processos/:id/adicionais', ({ params, body }) => {
    const u = exigir('orcamento.editar');
    if (!can(u, 'valores.ver')) throw new ApiError(403, 'Não tem permissão para ver valores.');
    const p = obterProcesso(params.id);
    exigirEstado(p, 'em_reparacao');
    const pecas = validarLinhasPecas(body?.pecas);
    const maoObra = validarLinhasMaoObra(body?.maoObra);
    if (pecas.length + maoObra.length === 0) throw new ApiError(422, 'Adicione pelo menos uma linha ao trabalho adicional.');
    const adicional = {
      id: novoId('adicional', 'ad'),
      justificacao: texto(body?.justificacao, 'Justificação', 10, 1000),
      pecas,
      maoObra,
      taxaIva: db().configuracao.taxaIva,
      criadoEm: new Date().toISOString(),
      criadoPorId: u.id,
      estado: 'enviado' as const,
    };
    p.orcamentosAdicionais = [...(p.orcamentosAdicionais ?? []), adicional];
    registarHistorico(p, u.nome, `Trabalho adicional proposto ao cliente: ${adicional.justificacao}`, 'nota');
    notificar({ perfis: ['rececionista', 'administrativa'] }, 'Trabalho adicional para aprovar', `${p.numero} — pedir a decisão ao cliente.`, `/processos/${p.id}`, u.id);
    auditar(u.id, 'criar_adicional', 'processo', p.id, String(calcularTotais(adicional).total));
    return guardarEDetalhar(p, u);
  }],

  ['POST', '/processos/:id/adicionais/:aid/decisao', ({ params, body }) => {
    const u = exigir('aprovacao.registar');
    const p = obterProcesso(params.id);
    exigirEstado(p, 'em_reparacao');
    const a = (p.orcamentosAdicionais ?? []).find((x) => x.id === params.aid);
    if (!a) throw new ApiError(404, 'Trabalho adicional não encontrado.');
    if (a.estado !== 'enviado') throw new ApiError(422, 'Este trabalho adicional já foi decidido.');
    const decisao = umDe(body?.decisao, ['aprovado', 'recusado'] as const, 'Decisão');
    const metodo = umDe(body?.metodo, METODOS.filter((m) => m !== 'portal'), 'Método');
    decidirAdicional(p, a, u, decisao, metodo, texto(body?.autorizadoPor, 'Nome de quem decidiu', 3, 120));
    return guardarEDetalhar(p, u);
  }],

  // Controlo de qualidade: aprovado → pronta para entrega (fatura emitida); reprovado → volta à reparação.
  ['PUT', '/processos/:id/qualidade', ({ params, body }) => {
    const u = exigir('qualidade.validar');
    const p = obterProcesso(params.id);
    exigirEstado(p, 'controlo_qualidade');
    const itens = (Array.isArray(body?.itens) ? body.itens : []).map((i: any) => {
      if (typeof i?.conforme !== 'boolean') throw new ApiError(422, `Indique se "${i?.item}" está conforme.`);
      return { item: texto(i.item, 'Item', 2, 100), conforme: i.conforme as boolean, nota: i.nota ? String(i.nota).slice(0, 300) : undefined };
    });
    if (itens.length === 0) throw new ApiError(422, 'A checklist não tem itens.');
    const falhas = itens.filter((i: any) => !i.conforme);
    if (falhas.some((i: any) => !i.nota)) throw new ApiError(422, 'Descreva o problema em cada item não conforme.');
    const aprovado = falhas.length === 0;
    p.checklistQualidade = {
      itens,
      responsavelId: u.id,
      dataHora: new Date().toISOString(),
      aprovado,
      observacoes: body?.observacoes ? String(body.observacoes).slice(0, 1000) : undefined,
    };
    if (aprovado) {
      emitirFatura(p);
      mudarEstado(p, u, 'pronta_entrega', `Controlo de qualidade aprovado — fatura ${p.fatura!.numero} emitida`);
    } else {
      p.retrabalhos = (p.retrabalhos ?? 0) + 1;
      p.tarefas = [
        ...(p.tarefas ?? []),
        ...falhas.map((f: any) => ({ id: novoId('tarefa', 't'), descricao: `Corrigir: ${f.item} — ${f.nota}`, origem: 'mao_obra' as const, feita: false })),
      ];
      p.estado = 'em_reparacao';
      registarHistorico(p, u.nome, `Reprovado no controlo de qualidade (${falhas.map((f: any) => f.item).join(', ')}) — voltou à reparação`, 'rejeicao', 'em_reparacao');
      auditar(u.id, 'reprovar_qualidade', 'processo', p.id);
      notificarMudanca(p, 'controlo_qualidade', u.id);
    }
    return guardarEDetalhar(p, u);
  }],

  ['POST', '/processos/:id/pagamentos', ({ params, body }) => {
    const u = exigir('pagamentos.registar');
    const p = obterProcesso(params.id);
    exigirEstado(p, 'em_reparacao', 'controlo_qualidade', 'pronta_entrega');
    const pg = validarPagamento(body, p, u);
    if (p.fatura) p.fatura.pagamentos.push(pg);
    else p.adiantamentos = [...(p.adiantamentos ?? []), pg];
    registarHistorico(p, u.nome, `Pagamento registado: ${pg.valor.toLocaleString('pt-PT')} Kz (${pg.forma})`, 'nota');
    auditar(u.id, 'pagamento', 'processo', p.id, String(pg.valor));
    return guardarEDetalhar(p, u);
  }],

  ['POST', '/processos/:id/entrega', ({ params, body }) => {
    const u = exigir('entrega.registar');
    const p = obterProcesso(params.id);
    exigirEstado(p, 'pronta_entrega');
    if (!faturaPaga(p.fatura)) throw new ApiError(422, 'A fatura tem de estar totalmente paga antes da entrega.');
    const km = numero(body?.km, 'Quilometragem na entrega', { min: p.fichaRecepcao.km, max: p.fichaRecepcao.km + 2000, inteiro: true });
    const assinaturaAnexoId = anexoValido(p, body?.assinaturaAnexoId, 'assinatura_entrega', 'Recolha a assinatura do cliente na entrega.');
    p.entrega = {
      data: new Date().toISOString(),
      km,
      combustivel: numero(body?.combustivel, 'Combustível', { min: 0, max: 100 }),
      observacoes: body?.observacoes ? String(body.observacoes).slice(0, 1000) : undefined,
      assinaturaAnexoId,
      entreguePorId: u.id,
    };
    const viatura = db().viaturas.find((v) => v.id === p.viaturaId);
    if (viatura && km > viatura.km) viatura.km = km;
    mudarEstado(p, u, 'entregue', 'Viatura entregue ao cliente');
    return guardarEDetalhar(p, u);
  }],

  ['GET', '/processos/:id/anexos', ({ params }) => {
    exigir('processos.ver');
    obterProcesso(params.id);
    return db().anexos.filter((a) => a.processoId === params.id);
  }],

  ['POST', '/processos/:id/cancelar', ({ params, body }) => {
    const u = exigir('processos.cancelar');
    const p = obterProcesso(params.id);
    const motivo = String(body?.motivo ?? '').trim();
    if (!estaAtivo(p.estado)) throw new ApiError(422, 'Este processo já está encerrado.');
    if (motivo.length < 5) throw new ApiError(422, 'Indique o motivo do cancelamento (mínimo 5 caracteres).');
    if (recebidoProcesso(p) > 0) throw new ApiError(422, 'Este processo tem pagamentos registados. Trate primeiro da devolução com a administração.');
    p.cancelamento = { motivo, data: new Date().toISOString(), autorId: u.id, estadoAnterior: p.estado };
    p.estado = 'cancelado';
    registarHistorico(p, u.nome, `Processo cancelado: ${motivo}`, 'cancelamento', 'cancelado');
    auditar(u.id, 'cancelar', 'processo', p.id, motivo);
    notificarMudanca(p, p.cancelamento.estadoAnterior, u.id);
    return guardarEDetalhar(p, u);
  }],
];

function validarPagamento(dados: any, p: Processo, u: UtilizadorComSenha): Pagamento {
  const forma = umDe(dados?.forma, FORMAS, 'Forma de pagamento');
  const emDivida = p.fatura ? saldoEmAberto(p.fatura) : totalFaturavel(p) - recebidoProcesso(p);
  const valor = numero(dados?.valor, 'Valor', { min: 1 });
  if (valor > emDivida + 0.01) throw new ApiError(422, `O valor excede o montante em dívida (${Math.round(emDivida).toLocaleString('pt-PT')} Kz).`);
  const referencia = dados?.referencia ? String(dados.referencia).trim().slice(0, 60) : undefined;
  if ((forma === 'transferencia' || forma === 'multicaixa') && !referencia) {
    throw new ApiError(422, 'Indique a referência da transferência / Multicaixa.');
  }
  exigirCaixaAberta();
  return { id: novoId('pagamento', 'pg'), numeroRecibo: proximoRecibo(), data: new Date().toISOString(), valor, forma, referencia, registadoPorId: u.id };
}
