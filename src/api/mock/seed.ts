// Dados de demonstração para o modo simulado. Gerados de forma determinística (mesma semente)
// relativamente à data em que a base simulada é criada.

import type {
  Anexo,
  FechoCaixa,
  Encomenda,
  Fornecedor,
  MovimentoStock,
  Marcacao,
  Tarefa,
  Cliente,
  Configuracao,
  EstadoProcesso,
  EventoAuditoria,
  HistoricoEvento,
  ItemDiagnostico,
  Pagamento,
  Peca,
  Processo,
  Utilizador,
  Viatura,
} from '../../types';
import { ESTADOS_ORDEM, ESTADO_LABEL, SISTEMAS_VEICULO, VERIFICACOES_SEGURANCA } from '../../types';
import { calcularTotais } from '../../lib/calculos';

export const VERSAO_DB = 9;
export const SENHA_DEMO = 'mzd2026';

export type UtilizadorComSenha = Utilizador & { senha: string };

export interface MockDB {
  versao: number;
  utilizadores: UtilizadorComSenha[];
  clientes: Cliente[];
  viaturas: Viatura[];
  pecas: Peca[];
  processos: Processo[];
  configuracao: Configuracao;
  auditoria: EventoAuditoria[];
  anexos: Anexo[];
  marcacoes: Marcacao[];
  fechos: FechoCaixa[];
  fornecedores: Fornecedor[];
  movimentos: MovimentoStock[];
  encomendas: Encomenda[];
  sequencias: {
    processo: number; fatura: number; peca: number; auditoria: number; pagamento: number;
    cliente: number; viatura: number; tarefa: number; tempo: number; adicional: number; anexo: number; marcacao: number;
    fornecedor: number; movimento: number; encomenda: number; recibo: number; fecho: number;
  };
}

function seedRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function semAcentos(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function criarSeed(): MockDB {
  const rnd = seedRandom(42);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
  const agora = Date.now();

  // ---------- Utilizadores ----------
  const baseUtilizadores: Omit<Utilizador, 'email' | 'avatarIniciais' | 'ativo'>[] = [
    { id: 'u1', nome: 'Sara Neto', perfil: 'rececionista' },
    { id: 'u2', nome: 'Domingos Kiala', perfil: 'mecanico', osConcluidas: 34, tempoMedioHoras: 5.2 },
    { id: 'u3', nome: 'Bruno Sachipengo', perfil: 'mecanico', osConcluidas: 28, tempoMedioHoras: 6.1 },
    { id: 'u4', nome: 'Isabel Manuel', perfil: 'mecanico', osConcluidas: 41, tempoMedioHoras: 4.6 },
    { id: 'u5', nome: 'Cátia Fortunato', perfil: 'administrativa' },
    { id: 'u6', nome: 'Joel Paulo', perfil: 'chefe_oficina' },
    { id: 'u7', nome: 'Amélia Zola', perfil: 'direcao' },
    { id: 'u8', nome: 'Nelson Tavares', perfil: 'admin' },
  ];
  const utilizadores: UtilizadorComSenha[] = baseUtilizadores.map((u) => {
    const partes = semAcentos(u.nome).toLowerCase().split(' ');
    return {
      ...u,
      email: `${partes[0]}.${partes[partes.length - 1]}@mzdcarros.ao`,
      avatarIniciais: u.nome.split(' ').map((p) => p[0]).slice(0, 2).join(''),
      ativo: true,
      senha: SENHA_DEMO,
    };
  });

  // ---------- Clientes ----------
  const nomesClientes = [
    'António Ferreira', 'Beatriz Sanjala', 'Carlos Mbala', 'Diana Quifica', 'Eduardo Neto',
    'Filomena Cassoma', 'Gerson Tati', 'Helena Bumba', 'Ivo Capemba', 'Joana Vieira Dias',
    'Kianda Manuel', 'Luísa Chindongo', 'Marcelino Ondjaki', 'Nádia Pedro', 'Osvaldo Ricardo',
    'Paula Kiese', 'Quintino Afonso', 'Rosa Bento', 'Sebastião Gove', 'Teresa Muanza',
  ];
  const clientes: Cliente[] = nomesClientes.map((nome, i) => ({
    id: `c${i + 1}`,
    nome,
    telefone: `+244 9${int(1, 9)}${int(1000000, 9999999)}`,
    email: `${semAcentos(nome.split(' ')[0]).toLowerCase()}@email.com`,
    nif: `${int(100000000, 999999999)}LA${int(10, 99)}`,
    morada: 'Luanda, Angola',
    desde: `202${int(1, 4)}-0${int(1, 9)}-${int(10, 28)}`,
    consentimentoMensagens: rnd() > 0.15,
  }));

  // ---------- Viaturas ----------
  const marcasModelos: [string, string[]][] = [
    ['Toyota', ['Hilux', 'Corolla', 'RAV4', 'Land Cruiser']],
    ['Hyundai', ['Tucson', 'Accent', 'Santa Fe']],
    ['Mercedes-Benz', ['C 200', 'GLE', 'Sprinter']],
    ['Nissan', ['Navara', 'X-Trail', 'Almera']],
    ['Kia', ['Sportage', 'Sorento', 'Picanto']],
    ['Volkswagen', ['Polo', 'Amarok', 'Tiguan']],
  ];
  const cores = ['Branco', 'Preto', 'Cinza', 'Prata', 'Vermelho', 'Azul'];
  const viaturas: Viatura[] = clientes.flatMap((cliente, i) => {
    const nViaturas = i % 5 === 0 ? 2 : 1;
    return Array.from({ length: nViaturas }, (_, j) => {
      const [marca, modelos] = pick(marcasModelos);
      return {
        id: `v${i + 1}_${j + 1}`,
        clienteId: cliente.id,
        matricula: `LD-${int(10, 99)}-${int(10, 99)}-${['AA', 'BC', 'DE', 'EF', 'GH'][int(0, 4)]}`,
        marca,
        modelo: pick(modelos),
        ano: int(2012, 2024),
        cor: pick(cores),
        chassi: `9BW${int(100000000, 999999999)}`,
        km: int(8000, 180000),
      };
    });
  });

  // Duplicados realistas, para demonstrar a junção de clientes: o mesmo cliente registado
  // duas vezes (telefone escrito sem indicativo; nome sem acentos).
  clientes.push(
    {
      id: 'c21', nome: 'Antonio Ferreira', telefone: clientes[0].telefone.replace('+244 ', '').replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3'),
      desde: '2025-11-03', consentimentoMensagens: false, email: 'a.ferreira@empresa.ao',
    },
    { id: 'c22', nome: 'Luisa Chindongo', telefone: '+244 931 222 333', desde: '2026-02-14', consentimentoMensagens: true },
  );
  viaturas.push({ id: 'v21_1', clienteId: 'c21', matricula: 'LD-12-34-EF', marca: 'Kia', modelo: 'Picanto', ano: 2019, cor: 'Vermelho', chassi: '9BW123456789', km: 54000 });

  // ---------- Peças ----------
  const fornecedores: Fornecedor[] = [
    { id: 'f1', nome: 'AutoParts Angola', telefone: '+244 222 330 100', email: 'vendas@autoparts.ao', nif: '5417000111', prazoEntregaDias: 2, ativo: true },
    { id: 'f2', nome: 'Lubrimax', telefone: '+244 222 445 210', email: 'encomendas@lubrimax.ao', prazoEntregaDias: 1, ativo: true },
    { id: 'f3', nome: 'SuspensãoTotal', telefone: '+244 923 120 330', prazoEntregaDias: 4, ativo: true },
    { id: 'f4', nome: 'PowerCell', telefone: '+244 931 004 556', email: 'geral@powercell.ao', prazoEntregaDias: 3, ativo: true },
    { id: 'f5', nome: 'PneuMax', telefone: '+244 222 770 880', prazoEntregaDias: 2, ativo: true },
    { id: 'f6', nome: 'ClimaParts', telefone: '+244 912 660 770', email: 'pedidos@climaparts.ao', prazoEntregaDias: 7, ativo: true },
  ];
  // precoCusto ≈ 60–70% do preço de venda (margens típicas de peças).
  const pecas: Peca[] = [
    { id: 'p1', referencia: 'TRV-PAS-D01', nome: 'Pastilhas de travão (jogo dianteiro)', categoria: 'Travões', fornecedorId: 'f1', precoCusto: 29000, precoBase: 45000, stock: 18, stockMinimo: 6, localizacao: 'A1' },
    { id: 'p2', referencia: 'TRV-DIS-P02', nome: 'Discos de travão (par)', categoria: 'Travões', fornecedorId: 'f1', precoCusto: 51000, precoBase: 78000, stock: 9, stockMinimo: 4, localizacao: 'A1' },
    { id: 'p3', referencia: 'FLU-5W30-1L', nome: 'Óleo motor 5W30 (litro)', categoria: 'Fluidos', fornecedorId: 'f2', precoCusto: 7200, precoBase: 12000, stock: 64, stockMinimo: 20, localizacao: 'B3' },
    { id: 'p4', referencia: 'MOT-FOL-004', nome: 'Filtro de óleo', categoria: 'Motor', fornecedorId: 'f2', precoCusto: 5100, precoBase: 8500, stock: 40, stockMinimo: 15, localizacao: 'B2' },
    { id: 'p5', referencia: 'MOT-FAR-005', nome: 'Filtro de ar', categoria: 'Motor', fornecedorId: 'f1', precoCusto: 5900, precoBase: 9500, stock: 22, stockMinimo: 10, localizacao: 'B2' },
    { id: 'p6', referencia: 'SUS-AMO-D06', nome: 'Amortecedor dianteiro', categoria: 'Suspensão', fornecedorId: 'f3', precoCusto: 43000, precoBase: 65000, stock: 5, stockMinimo: 4, localizacao: 'C1' },
    { id: 'p7', referencia: 'ELE-BAT-60A', nome: 'Bateria 60Ah', categoria: 'Elétrico', fornecedorId: 'f4', precoCusto: 66000, precoBase: 95000, stock: 3, stockMinimo: 5, localizacao: 'D1' },
    { id: 'p8', referencia: 'MOT-COR-D08', nome: 'Correia de distribuição', categoria: 'Motor', fornecedorId: 'f1', precoCusto: 24500, precoBase: 38000, stock: 11, stockMinimo: 5, localizacao: 'B4' },
    { id: 'p9', referencia: 'PNE-205-55R16', nome: 'Pneu 205/55 R16', categoria: 'Pneus', fornecedorId: 'f5', precoCusto: 49000, precoBase: 72000, stock: 16, stockMinimo: 8, localizacao: 'E' },
    { id: 'p10', referencia: 'AC-COMP-010', nome: 'Compressor A/C', categoria: 'Ar Condicionado', fornecedorId: 'f6', precoCusto: 101000, precoBase: 145000, stock: 2, stockMinimo: 3, localizacao: 'D2' },
  ];

  const configuracao: Configuracao = {
    empresa: {
      nome: 'MZD Carros e Motores',
      nif: '5000000000',
      morada: 'Luanda, Angola',
      telefone: '+244 923 000 000',
      email: 'geral@mzdcarros.ao',
    },
    taxaIva: 14,
    valorHora: 8500,
    validadeOrcamentoDias: 15,
    garantiaPecasMeses: 6,
    garantiaMaoObraMeses: 3,
    capacidadeDiaria: 6,
    descontoMaximoPct: 5,
  };

  // ---------- Processos ----------
  const sistemasVeiculo = SISTEMAS_VEICULO;
  let seqTarefa = 0;
  let seqTempo = 0;
  const queixas = [
    'Ruído estranho ao travar', 'Ar condicionado não arrefece', 'Consumo elevado de combustível',
    'Luz de avaria acesa no painel', 'Dificuldade em engatar mudanças', 'Vibração no volante em velocidade',
    'Fuga de óleo visível no chão', 'Bateria descarrega com facilidade', 'Barulho na suspensão em lombas',
    'Revisão periódica programada',
  ];
  const motivosRecusa = ['Preço elevado', 'Vai comparar orçamentos', 'Vai vender a viatura', 'Sem urgência'];

  const distribuicao: EstadoProcesso[] = [
    'recepcao', 'recepcao',
    'diagnostico', 'diagnostico',
    'orcamentacao', 'orcamentacao',
    'aguarda_aprovacao', 'aguarda_aprovacao',
    'em_reparacao', 'em_reparacao', 'em_reparacao', 'em_reparacao',
    'controlo_qualidade',
    'pronta_entrega', 'pronta_entrega',
    'entregue', 'entregue', 'entregue', 'entregue', 'entregue', 'entregue', 'entregue', 'entregue',
    'cancelado', 'cancelado',
  ];
  const mecanicosIds = ['u2', 'u3', 'u4'];
  const nomeDe = (id: string) => utilizadores.find((u) => u.id === id)!.nome;
  let seqPagamento = 0;

  const processos: Processo[] = distribuicao.map((estado, i) => {
    const viatura = viaturas[i % viaturas.length];
    const cliente = clientes.find((c) => c.id === viatura.clienteId)!;
    const cancelado = estado === 'cancelado';
    // Um processo cancelado percorreu o fluxo até à aprovação e foi recusado.
    const estadoAlcancado: EstadoProcesso = cancelado ? 'aguarda_aprovacao' : estado;
    const idx = ESTADOS_ORDEM.indexOf(estadoAlcancado);
    const chegou = (e: EstadoProcesso) => idx >= ESTADOS_ORDEM.indexOf(e);

    // Idade coerente com a etapa: ativos recentes (mais avançados = mais antigos), entregues ao longo
    // de 6 meses (para haver histórico de faturação) e cancelados nas últimas semanas.
    const diasAtras =
      estado === 'entregue' ? int(3, 170) : cancelado ? int(4, 50) : int(Math.floor(idx / 2), idx + 2);
    const criadoEm = new Date(agora - diasAtras * 86400000 - int(1, 8) * 3600000);
    const prazoEntrega = new Date(criadoEm.getTime() + int(Math.max(2, Math.ceil(idx / 2)), idx + 4) * 86400000);
    const mecanicoId = pick(mecanicosIds);
    const atendenteId = 'u1';

    // Datas de entrada em cada etapa (nunca no futuro).
    const datasEtapa: Partial<Record<EstadoProcesso, string>> = {};
    let d = criadoEm.getTime();
    for (let k = 0; k <= idx; k++) {
      datasEtapa[ESTADOS_ORDEM[k]] = new Date(Math.min(d, agora)).toISOString();
      d += int(3, 30) * 3600 * 1000;
    }
    const dataCancelamento = cancelado ? new Date(Math.min(d, agora)).toISOString() : undefined;

    const autores = [nomeDe('u1'), nomeDe(mecanicoId), nomeDe('u5'), nomeDe('u6')];
    const historico: HistoricoEvento[] = ESTADOS_ORDEM.slice(0, idx + 1).map((e, k) => ({
      id: `h${k}`,
      data: datasEtapa[e]!,
      autor: e === 'recepcao' ? nomeDe('u1') : pick(autores),
      descricao: k === 0 ? 'Processo aberto na receção' : `Processo avançou para "${ESTADO_LABEL[e]}"`,
      tipo: 'estado',
      estado: e,
    }));

    const pecasOrc = chegou('orcamentacao')
      ? Array.from({ length: int(1, 3) }, () => {
          const p = pick(pecas);
          return { pecaId: p.id, descricao: p.nome, quantidade: int(1, 2), precoUnitario: p.precoBase };
        })
      : [];
    const maoObraOrc = chegou('orcamentacao')
      ? [{ descricao: 'Mão de obra especializada', horas: int(1, 8), valorHora: configuracao.valorHora }]
      : [];
    const orcamento = chegou('orcamentacao')
      ? {
          pecas: pecasOrc,
          maoObra: maoObraOrc,
          taxaIva: configuracao.taxaIva,
          validadeDias: configuracao.validadeOrcamentoDias,
          condicoesPagamento: '50% na autorização, 50% na entrega',
          enviadoEm: datasEtapa.aguarda_aprovacao,
          estado: cancelado
            ? ('recusado' as const)
            : chegou('em_reparacao')
              ? ('aprovado' as const)
              : chegou('aguarda_aprovacao')
                ? ('enviado' as const)
                : ('rascunho' as const),
          motivoRecusa: cancelado ? pick(motivosRecusa) : undefined,
        }
      : undefined;
    const total = calcularTotais(orcamento).total;

    // Pagamentos: adiantamento de 50% em parte dos casos; restante na entrega.
    const pagamentos: Pagamento[] = [];
    const comAdiantamento = chegou('em_reparacao') && rnd() > 0.4;
    if (comAdiantamento) {
      pagamentos.push({
        id: `pg${++seqPagamento}`, numeroRecibo: '', data: datasEtapa.em_reparacao!, valor: Math.round(total / 2),
        forma: pick(['transferencia', 'tpa', 'multicaixa']), referencia: `REF${int(100000, 999999)}`, registadoPorId: 'u5',
      });
    }
    if (estado === 'entregue') {
      pagamentos.push({
        id: `pg${++seqPagamento}`, numeroRecibo: '', data: datasEtapa.entregue!, valor: total - (comAdiantamento ? Math.round(total / 2) : 0),
        forma: pick(['numerario', 'numerario', 'tpa', 'multicaixa']), registadoPorId: 'u5',
      });
    }

    const itensDiag: ItemDiagnostico[] = chegou('diagnostico')
      ? sistemasVeiculo.map((sistema) => {
          const r = rnd();
          const est = r > 0.82 ? 'critico' : r > 0.55 ? 'atencao' : 'ok';
          return {
            sistema,
            estado: est,
            observacao: est !== 'ok' ? pick(['Necessita substituição', 'Desgaste acentuado', 'Verificar na próxima revisão', 'Fuga detetada']) : undefined,
          };
        })
      : [];

    // Tarefas de reparação geradas a partir do orçamento aprovado.
    const tarefas: Tarefa[] | undefined = chegou('em_reparacao')
      ? [
          ...maoObraOrc.map((m) => ({ descricao: m.descricao, origem: 'mao_obra' as const })),
          ...pecasOrc.map((pc) => ({ descricao: `Montar ${pc.descricao}${pc.quantidade > 1 ? ` (×${pc.quantidade})` : ''}`, origem: 'peca' as const, pecaId: pc.pecaId, quantidade: pc.quantidade })),
        ].map((t) => {
          const feita = chegou('controlo_qualidade') || rnd() > 0.5;
          return { id: `t${++seqTarefa}`, ...t, feita, feitaPorId: feita ? mecanicoId : undefined, feitaEm: feita ? datasEtapa.em_reparacao : undefined };
        })
      : undefined;
    const registosTempo = chegou('em_reparacao')
      ? [{
          id: `r${++seqTempo}`,
          mecanicoId,
          inicio: datasEtapa.em_reparacao!,
          fim: new Date(Math.min(new Date(datasEtapa.em_reparacao!).getTime() + int(1, 7) * 3600000, agora)).toISOString(),
        }]
      : undefined;
    const aguardaPecas = estado === 'em_reparacao' && rnd() > 0.7;

    if (cancelado) {
      historico.push({
        id: `h${historico.length}`,
        data: dataCancelamento!,
        autor: nomeDe('u1'),
        descricao: `Orçamento recusado pelo cliente (${orcamento!.motivoRecusa}). Processo cancelado.`,
        tipo: 'cancelamento',
        estado: 'cancelado',
      });
    }

    const processo: Processo = {
      id: `proc${i + 1}`,
      numero: `OS-2026-${String(1000 + i)}`,
      clienteId: cliente.id,
      viaturaId: viatura.id,
      estado,
      criadoEm: criadoEm.toISOString(),
      prazoEntrega: prazoEntrega.toISOString(),
      mecanicoId: chegou('diagnostico') ? mecanicoId : undefined,
      atendenteId,
      urgente: rnd() > 0.85,
      aguardaPecas,
      notaPecas: aguardaPecas ? 'Encomendado ao fornecedor — previsão de 2 dias' : undefined,
      tarefas,
      registosTempo,
      adiantamentos: chegou('em_reparacao') && !chegou('pronta_entrega') ? pagamentos : undefined,
      fichaRecepcao: {
        queixaCliente: pick(queixas),
        km: viatura.km - int(0, 500),
        combustivel: int(10, 100),
        bateria: pick(['boa', 'fraca', 'a_testar']),
        danos: [{ x: int(20, 80), y: int(20, 80), tipo: 'risco', vista: 'topo' }],
        pertences: pick(['Nenhum', 'Documentos no porta-luvas', 'Triângulo e colete', 'Óculos de sol']),
        dataHora: criadoEm.toISOString(),
        assinaturaCliente: true,
        atendenteId,
      },
      diagnostico: chegou('diagnostico')
        ? {
            itens: itensDiag,
            parecerGeral: 'Viatura apresenta desgaste compatível com o uso e quilometragem. Recomenda-se intervenção nos itens assinalados.',
            recomendacao: pick(['reparar', 'substituir', 'ambos']),
            urgencia: pick(['baixo', 'medio', 'alto', 'seguranca']),
            mecanicoId,
            concluidoEm: datasEtapa.orcamentacao,
          }
        : undefined,
      orcamento,
      autorizacao: chegou('em_reparacao')
        ? { valorTotal: total, metodo: pick(['presencial', 'email', 'whatsapp']), data: datasEtapa.em_reparacao!, autorizadoPor: cliente.nome }
        : undefined,
      checklistQualidade: chegou('pronta_entrega')
        ? {
            itens: [
              ...itensDiag.filter((d) => d.estado !== 'ok').map((d) => ({ item: d.sistema, conforme: true })),
              ...VERIFICACOES_SEGURANCA.map((v) => ({ item: v, conforme: true })),
            ],
            responsavelId: 'u6',
            dataHora: datasEtapa.pronta_entrega,
            aprovado: true,
          }
        : undefined,
      fatura: chegou('pronta_entrega')
        ? { numero: `FT-2026-${String(2000 + i)}`, data: datasEtapa.pronta_entrega!, valorTotal: total, pagamentos }
        : undefined,
      garantias: chegou('pronta_entrega')
        ? [
            { item: 'Peças instaladas', tipo: 'peca', prazoMeses: configuracao.garantiaPecasMeses },
            { item: 'Mão de obra', tipo: 'mao_obra', prazoMeses: configuracao.garantiaMaoObraMeses },
          ]
        : undefined,
      entrega: estado === 'entregue'
        ? {
            data: datasEtapa.entregue!,
            km: viatura.km,
            combustivel: int(15, 90),
            entreguePorId: 'u1',
          }
        : undefined,
      cancelamento: cancelado
        ? { motivo: `Orçamento recusado: ${orcamento!.motivoRecusa}`, data: dataCancelamento!, autorId: 'u1', estadoAnterior: 'aguarda_aprovacao' }
        : undefined,
      historico,
    };
    return processo;
  });

  // ---------- Marcações ----------
  // Semana passada (chegaram ou faltaram) e próximas duas semanas (agendadas/confirmadas).
  // Algumas são de pessoas que ainda não são clientes (só nome, telefone e matrícula).
  const marcacoes: Marcacao[] = [];
  const novos = [
    { nome: 'Henrique Lopes', telefone: '+244 923 410 552', matricula: 'LD-51-20-HA' },
    { nome: 'Celeste Matamba', telefone: '+244 931 887 120', matricula: 'LD-08-63-BC' },
    { nome: 'Eduardo Sapalo', telefone: '+244 912 300 455' },
  ];
  const horas = ['08:00', '08:30', '09:00', '10:00', '11:00', '14:00', '15:30'];
  const tipos: Marcacao['tipo'][] = ['revisao', 'revisao', 'diagnostico', 'reparacao', 'outro'];
  for (let dia = -6; dia <= 12; dia++) {
    const d = new Date(agora + dia * 86400000);
    if (d.getDay() === 0) continue;
    const n = d.getDay() === 6 ? int(0, 2) : int(1, 4);
    const usadas = new Set<string>();
    for (let k = 0; k < n; k++) {
      const [h, m] = pick(horas).split(':').map(Number);
      const data = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString();
      const deNovo = rnd() > 0.8;
      // Uma marcação por viatura em cada dia.
      let v = pick(viaturas);
      while (usadas.has(v.id)) v = pick(viaturas);
      usadas.add(v.id);
      const c = clientes.find((x) => x.id === v.clienteId)!;
      const contacto = deNovo ? pick(novos) : { nome: c.nome, telefone: c.telefone, matricula: v.matricula };
      marcacoes.push({
        id: `m${marcacoes.length + 1}`,
        data,
        tipo: pick(tipos),
        estado: dia < 0 ? (rnd() > 0.8 ? 'faltou' : 'chegou') : dia === 0 ? 'confirmada' : rnd() > 0.5 ? 'confirmada' : 'agendada',
        clienteId: deNovo ? undefined : c.id,
        viaturaId: deNovo ? undefined : v.id,
        nome: contacto.nome,
        telefone: contacto.telefone,
        matricula: contacto.matricula,
        notas: rnd() > 0.7 ? pick(['Cliente pediu para ser atendido cedo', 'Traz a fatura da última revisão', 'Ligar na véspera a confirmar']) : undefined,
        criadoPorId: 'u1',
        criadoEm: new Date(agora + (dia - 7) * 86400000).toISOString(),
      });
    }
  }
  marcacoes.sort((a, b) => a.data.localeCompare(b.data));

  // ---------- Financeiro: recibos por ordem cronológica, fechos de caixa e um desconto pendente ----------
  const todosPagamentos = processos
    .flatMap((x) => [...(x.fatura?.pagamentos ?? []), ...(x.adiantamentos ?? [])])
    .sort((a, b) => a.data.localeCompare(b.data));
  todosPagamentos.forEach((pg, i) => {
    pg.numeroRecibo = `RC-${pg.data.slice(0, 4)}-${String(i + 1).padStart(4, '0')}`;
  });
  const diaLocal = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const hojeLocal = diaLocal(new Date(agora).toISOString());
  const fechos: FechoCaixa[] = [...new Set(todosPagamentos.map((pg) => diaLocal(pg.data)))]
    .filter((d) => d < hojeLocal)
    .map((dia, i) => {
      const doDia = todosPagamentos.filter((pg) => diaLocal(pg.data) === dia);
      const totais = { numerario: 0, transferencia: 0, tpa: 0, multicaixa: 0 };
      doDia.forEach((pg) => { totais[pg.forma] += pg.valor; });
      return {
        id: `fc${i + 1}`, dia, totais, numerarioContado: totais.numerario, diferenca: 0, nRecibos: doDia.length,
        notas: undefined as string | undefined,
        fechadoPorId: 'u5', fechadoEm: new Date(`${dia}T18:30:00`).toISOString(),
      };
    });
  // Um dia com pequena falta na gaveta, para mostrar a conferência do numerário.
  const comNumerario = fechos.find((f) => f.totais.numerario > 0);
  if (comNumerario) {
    comNumerario.diferenca = -2000;
    comNumerario.numerarioContado = comNumerario.totais.numerario - 2000;
    comNumerario.notas = 'Falta de 2 000 Kz — troco mal dado, comunicado à Direção';
  }
  const emOrcamento = processos.find((x) => x.estado === 'orcamentacao' && x.orcamento);
  if (emOrcamento) {
    emOrcamento.orcamento!.desconto = {
      percentagem: 10, motivo: 'Cliente frotista — 3 viaturas na oficina este ano', estado: 'pendente',
      pedidoPorId: 'u1', pedidoEm: new Date(agora - 3 * 3600000).toISOString(),
    };
  }

  // ---------- Stock: inventário inicial e encomendas ----------
  const movimentos: MovimentoStock[] = pecas.map((pc, i) => ({
    id: `mv${i + 1}`, pecaId: pc.id, tipo: 'acerto', quantidade: pc.stock, stockApos: pc.stock,
    data: new Date(agora - 60 * 86400000).toISOString(), utilizadorId: 'u5', motivo: 'Inventário inicial',
  }));
  const encomendas: Encomenda[] = [
    {
      id: 'e1', numero: 'ENC-2026-001', fornecedorId: 'f2', estado: 'recebida',
      linhas: [{ pecaId: 'p3', quantidade: 24, precoCusto: 7200, quantidadeRecebida: 24 }, { pecaId: 'p4', quantidade: 20, precoCusto: 5100, quantidadeRecebida: 20 }],
      processosIds: [], criadoEm: new Date(agora - 20 * 86400000).toISOString(), criadoPorId: 'u5',
      enviadaEm: new Date(agora - 20 * 86400000).toISOString(), recebidaEm: new Date(agora - 19 * 86400000).toISOString(),
    },
    {
      id: 'e2', numero: 'ENC-2026-002', fornecedorId: 'f4', estado: 'enviada',
      linhas: [{ pecaId: 'p7', quantidade: 6, precoCusto: 64000 }],
      processosIds: processos.filter((x) => x.aguardaPecas).map((x) => x.id).slice(0, 1),
      notas: 'Pedido por telefone — confirmar entrega', criadoEm: new Date(agora - 86400000).toISOString(), criadoPorId: 'u5',
      enviadaEm: new Date(agora - 86400000).toISOString(), previsaoEntrega: new Date(agora + 2 * 86400000).toISOString(),
    },
  ];

  return {
    versao: VERSAO_DB,
    utilizadores,
    clientes,
    viaturas,
    pecas,
    processos,
    configuracao,
    auditoria: [],
    marcacoes,
    fechos,
    fornecedores,
    movimentos,
    encomendas,
    anexos: [],
    sequencias: {
      processo: 1000 + processos.length, fatura: 2000 + processos.length, peca: pecas.length, auditoria: 0, pagamento: seqPagamento,
      cliente: clientes.length, viatura: viaturas.length, tarefa: seqTarefa, tempo: seqTempo, adicional: 0, anexo: 0, marcacao: marcacoes.length,
      fornecedor: fornecedores.length, movimento: movimentos.length, encomenda: encomendas.length,
      recibo: todosPagamentos.length, fecho: fechos.length,
    },
  };
}
