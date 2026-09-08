import type {
  Cliente,
  Viatura,
  Processo,
  Utilizador,
  Peca,
  EstadoProcesso,
  HistoricoEvento,
  ItemDiagnostico,
} from '../types';
import { ESTADOS_ORDEM } from '../types';

// ---------- Utilizadores ----------
export const utilizadores: Utilizador[] = [
  { id: 'u1', nome: 'Sara Neto', perfil: 'rececionista', avatarIniciais: 'SN', ativo: true },
  { id: 'u2', nome: 'Domingos Kiala', perfil: 'mecanico', avatarIniciais: 'DK', ativo: true, osConcluidas: 34, tempoMedioHoras: 5.2 },
  { id: 'u3', nome: 'Bruno Sachipengo', perfil: 'mecanico', avatarIniciais: 'BS', ativo: true, osConcluidas: 28, tempoMedioHoras: 6.1 },
  { id: 'u4', nome: 'Isabel Manuel', perfil: 'mecanico', avatarIniciais: 'IM', ativo: true, osConcluidas: 41, tempoMedioHoras: 4.6 },
  { id: 'u5', nome: 'Cátia Fortunato', perfil: 'administrativa', avatarIniciais: 'CF', ativo: true },
  { id: 'u6', nome: 'Joel Paulo', perfil: 'chefe_oficina', avatarIniciais: 'JP', ativo: true },
  { id: 'u7', nome: 'Amélia Zola', perfil: 'direcao', avatarIniciais: 'AZ', ativo: true },
];

export const utilizadorAtual = utilizadores[6]; // Direção por defeito (vê tudo) — trocável na UI

// ---------- Clientes ----------
const nomesClientes = [
  'António Ferreira', 'Beatriz Sanjala', 'Carlos Mbala', 'Diana Quifica', 'Eduardo Neto',
  'Filomena Cassoma', 'Gerson Tati', 'Helena Bumba', 'Ivo Capemba', 'Joana Vieira Dias',
  'Kianda Manuel', 'Luísa Chindongo', 'Marcelino Ondjaki', 'Nádia Pedro', 'Osvaldo Ricardo',
  'Paula Kiese', 'Quintino Afonso', 'Rosa Bento', 'Sebastião Gove', 'Teresa Muanza',
];

function seedRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
const rnd = seedRandom(42);
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;

export const clientes: Cliente[] = nomesClientes.map((nome, i) => ({
  id: `c${i + 1}`,
  nome,
  telefone: `+244 9${int(1, 9)}${int(1000000, 9999999)}`,
  email: `${nome.split(' ')[0].toLowerCase()}@email.com`,
  nif: `${int(100000000, 999999999)}LA${int(10, 99)}`,
  morada: 'Luanda, Angola',
  viaturasIds: [],
  desde: `202${int(1, 4)}-0${int(1, 9)}-${int(10, 28)}`,
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

export const viaturas: Viatura[] = clientes.flatMap((cliente, i) => {
  const nViaturas = i % 5 === 0 ? 2 : 1;
  return Array.from({ length: nViaturas }, (_, j) => {
    const [marca, modelos] = pick(marcasModelos);
    const id = `v${i + 1}_${j + 1}`;
    cliente.viaturasIds.push(id);
    return {
      id,
      clienteId: cliente.id,
      matricula: `LD-${int(10, 99)}-${int(10, 99)}-${['AA','BC','DE','EF','GH'][int(0,4)]}`,
      marca,
      modelo: pick(modelos),
      ano: int(2012, 2024),
      cor: pick(cores),
      chassi: `9BW${int(100000000, 999999999)}`,
      km: int(8000, 180000),
    };
  });
});

// ---------- Peças ----------
export const pecas: Peca[] = [
  { id: 'p1', nome: 'Pastilhas de travão (jogo dianteiro)', categoria: 'Travões', fornecedor: 'AutoParts Angola', precoBase: 45000, stock: 18, stockMinimo: 6 },
  { id: 'p2', nome: 'Discos de travão (par)', categoria: 'Travões', fornecedor: 'AutoParts Angola', precoBase: 78000, stock: 9, stockMinimo: 4 },
  { id: 'p3', nome: 'Óleo motor 5W30 (litro)', categoria: 'Fluidos', fornecedor: 'Lubrimax', precoBase: 12000, stock: 64, stockMinimo: 20 },
  { id: 'p4', nome: 'Filtro de óleo', categoria: 'Motor', fornecedor: 'Lubrimax', precoBase: 8500, stock: 40, stockMinimo: 15 },
  { id: 'p5', nome: 'Filtro de ar', categoria: 'Motor', fornecedor: 'AutoParts Angola', precoBase: 9500, stock: 22, stockMinimo: 10 },
  { id: 'p6', nome: 'Amortecedor dianteiro', categoria: 'Suspensão', fornecedor: 'SuspensãoTotal', precoBase: 65000, stock: 5, stockMinimo: 4 },
  { id: 'p7', nome: 'Bateria 60Ah', categoria: 'Elétrico', fornecedor: 'PowerCell', precoBase: 95000, stock: 3, stockMinimo: 5 },
  { id: 'p8', nome: 'Correia de distribuição', categoria: 'Motor', fornecedor: 'AutoParts Angola', precoBase: 38000, stock: 11, stockMinimo: 5 },
  { id: 'p9', nome: 'Pneu 205/55 R16', categoria: 'Pneus', fornecedor: 'PneuMax', precoBase: 72000, stock: 16, stockMinimo: 8 },
  { id: 'p10', nome: 'Compressor A/C', categoria: 'Ar Condicionado', fornecedor: 'ClimaParts', precoBase: 145000, stock: 2, stockMinimo: 3 },
];

// ---------- Processos ----------
const sistemasVeiculo = ['Motor', 'Travões', 'Suspensão/Direção', 'Sistema Elétrico', 'Ar Condicionado', 'Transmissão/Caixa', 'Pneus', 'Fluidos', 'Carroçaria'];
const queixas = [
  'Ruído estranho ao travar', 'Ar condicionado não arrefece', 'Consumo elevado de combustível',
  'Luz de avaria acesa no painel', 'Dificuldade em engatar mudanças', 'Vibração no volante em velocidade',
  'Fuga de óleo visível no chão', 'Bateria descarrega com facilidade', 'Barulho na suspensão em lombas',
  'Revisão periódica programada',
];

function gerarHistorico(estadoFinal: EstadoProcesso, criadoEm: Date, autores: string[]): HistoricoEvento[] {
  const idxFinal = ESTADOS_ORDEM.indexOf(estadoFinal);
  const eventos: HistoricoEvento[] = [];
  let d = new Date(criadoEm);
  for (let i = 0; i <= idxFinal; i++) {
    eventos.push({
      id: `h${i}`,
      data: d.toISOString(),
      autor: pick(autores),
      descricao: `Processo avançou para "${labelEstado(ESTADOS_ORDEM[i])}"`,
      tipo: 'estado',
    });
    d = new Date(d.getTime() + int(3, 30) * 3600 * 1000);
  }
  return eventos;
}

function labelEstado(e: EstadoProcesso) {
  const map: Record<EstadoProcesso, string> = {
    recepcao: 'Receção', diagnostico: 'Em Diagnóstico', aguarda_aprovacao_diagnostico: 'Aguarda Aprovação',
    orcamento_emitido: 'Orçamento Emitido', aguarda_autorizacao: 'Aguarda Autorização', em_reparacao: 'Em Reparação',
    controlo_qualidade: 'Controlo de Qualidade', pronta_entrega: 'Pronta para Entrega', entregue: 'Entregue',
  };
  return map[e];
}

function gerarDiagnostico(): ItemDiagnostico[] {
  return sistemasVeiculo.map((sistema) => {
    const r = rnd();
    const estado = r > 0.82 ? 'critico' : r > 0.55 ? 'atencao' : 'ok';
    return {
      sistema,
      estado,
      observacao: estado !== 'ok' ? pick(['Necessita substituição', 'Desgaste acentuado', 'Verificar na próxima revisão', 'Fuga detetada']) : undefined,
    };
  });
}

const estadosDistribuicao: EstadoProcesso[] = [
  'recepcao', 'recepcao',
  'diagnostico', 'diagnostico',
  'aguarda_aprovacao_diagnostico',
  'orcamento_emitido', 'orcamento_emitido',
  'aguarda_autorizacao',
  'em_reparacao', 'em_reparacao', 'em_reparacao', 'em_reparacao',
  'controlo_qualidade',
  'pronta_entrega', 'pronta_entrega',
  'entregue', 'entregue', 'entregue', 'entregue', 'entregue', 'entregue', 'entregue', 'entregue',
];

const mecanicosIds = ['u2', 'u3', 'u4'];

export const processos: Processo[] = estadosDistribuicao.map((estado, i) => {
  const viatura = viaturas[i % viaturas.length];
  const cliente = clientes.find((c) => c.id === viatura.clienteId)!;
  const diasAtras = int(0, 45);
  const criadoEm = new Date(Date.now() - diasAtras * 86400000);
  const prazoEntrega = new Date(criadoEm.getTime() + int(2, 7) * 86400000);
  const mecanicoId = pick(mecanicosIds);
  const atendenteId = 'u1';
  const idx = ESTADOS_ORDEM.indexOf(estado);

  const temDiagnostico = idx >= ESTADOS_ORDEM.indexOf('diagnostico');
  const diagnosticoAprovado = idx >= ESTADOS_ORDEM.indexOf('orcamento_emitido');
  const itensDiag = temDiagnostico ? gerarDiagnostico() : [];

  const temOrcamento = idx >= ESTADOS_ORDEM.indexOf('orcamento_emitido');
  const pecasOrc = temOrcamento
    ? Array.from({ length: int(1, 3) }, () => {
        const p = pick(pecas);
        return { descricao: p.nome, quantidade: int(1, 2), precoUnitario: p.precoBase };
      })
    : [];
  const maoObraOrc = temOrcamento
    ? [{ descricao: 'Mão de obra especializada', horas: int(1, 8), valorHora: 8500 }]
    : [];

  const valorTotalOrc =
    pecasOrc.reduce((s, p) => s + p.quantidade * p.precoUnitario, 0) +
    maoObraOrc.reduce((s, m) => s + m.horas * m.valorHora, 0);

  const temAutorizacao = idx >= ESTADOS_ORDEM.indexOf('em_reparacao');
  const temChecklist = idx >= ESTADOS_ORDEM.indexOf('controlo_qualidade');
  const temFatura = idx >= ESTADOS_ORDEM.indexOf('pronta_entrega');

  const proc: Processo = {
    id: `proc${i + 1}`,
    numero: `OS-2026-${String(1000 + i)}`,
    clienteId: cliente.id,
    viaturaId: viatura.id,
    estado,
    criadoEm: criadoEm.toISOString(),
    prazoEntrega: prazoEntrega.toISOString(),
    mecanicoId: idx >= ESTADOS_ORDEM.indexOf('diagnostico') ? mecanicoId : undefined,
    atendenteId,
    urgente: rnd() > 0.85,
    aguardaPecas: estado === 'em_reparacao' && rnd() > 0.7,
    fichaRecepcao: {
      queixaCliente: pick(queixas),
      km: viatura.km - int(0, 500),
      combustivel: int(10, 100),
      bateria: pick(['boa', 'fraca', 'a_testar']),
      danos: [
        { x: int(20, 80), y: int(20, 80), tipo: 'risco', vista: 'topo' },
      ],
      pertences: pick(['Nenhum', 'Documentos na porta-luvas', 'Triângulo e colete', 'Óculos de sol']),
      dataHora: criadoEm.toISOString(),
      assinaturaCliente: true,
      atendenteId,
    },
    diagnostico: temDiagnostico
      ? {
          itens: itensDiag,
          parecerGeral: 'Viatura apresenta desgaste compatível com o uso e quilometragem. Recomenda-se intervenção nos itens assinalados.',
          recomendacao: pick(['reparar', 'substituir', 'ambos']),
          urgencia: pick(['baixo', 'medio', 'alto', 'seguranca']),
          mecanicoId,
          aprovado: diagnosticoAprovado,
          aprovacao: diagnosticoAprovado
            ? { nomeCliente: cliente.nome, data: criadoEm.toISOString(), metodo: pick(['assinatura', 'digital', 'foto']) }
            : undefined,
        }
      : undefined,
    orcamento: temOrcamento
      ? {
          pecas: pecasOrc,
          maoObra: maoObraOrc,
          validadeDias: 15,
          condicoesPagamento: '50% na autorização, 50% na entrega',
          enviadoEm: criadoEm.toISOString(),
          estado: idx >= ESTADOS_ORDEM.indexOf('aguarda_autorizacao') ? 'aprovado' : 'enviado',
        }
      : undefined,
    autorizacao: temAutorizacao
      ? {
          valorTotal: valorTotalOrc,
          metodo: pick(['presencial', 'email', 'whatsapp']),
          data: criadoEm.toISOString(),
          autorizadoPor: cliente.nome,
        }
      : undefined,
    checklistQualidade: temChecklist
      ? {
          itens: sistemasVeiculo.map((s) => ({ item: s, conforme: true })),
          responsavelId: 'u6',
          dataHora: criadoEm.toISOString(),
          aprovado: true,
        }
      : undefined,
    fatura: temFatura
      ? {
          numero: `FT-2026-${String(2000 + i)}`,
          data: criadoEm.toISOString(),
          formaPagamento: pick(['numerario', 'transferencia', 'tpa', 'multicaixa']),
          pago: estado === 'entregue',
          valorPago: estado === 'entregue' ? valorTotalOrc : 0,
          valorTotal: valorTotalOrc,
        }
      : undefined,
    garantias: temFatura
      ? [
          { item: 'Peças instaladas', tipo: 'peca', prazoMeses: 6 },
          { item: 'Mão de obra', tipo: 'mao_obra', prazoMeses: 3 },
        ]
      : undefined,
    historico: gerarHistorico(estado, criadoEm, [utilizadores[0].nome, utilizadores.find(u=>u.id===mecanicoId)!.nome, utilizadores[4].nome, utilizadores[5].nome]),
  };
  return proc;
});

export const getCliente = (id: string) => clientes.find((c) => c.id === id)!;
export const getViatura = (id: string) => viaturas.find((v) => v.id === id)!;
export const getUtilizador = (id?: string) => utilizadores.find((u) => u.id === id);
export const getProcesso = (id: string) => processos.find((p) => p.id === id);
