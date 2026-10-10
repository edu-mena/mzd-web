import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Timer } from 'lucide-react';
import clsx from 'clsx';
import { useAcaoProcesso, useProcessos, useUtilizadores } from '../api/hooks';
import { api } from '../api/endpoints';
import { useAuth } from '../auth/useAuth';
import type { EstadoProcesso, ProcessoDetalhado, Utilizador } from '../types';
import { ESTADO_LABEL } from '../types';
import PageHeader from '../components/ui/PageHeader';
import StatTile from '../components/ui/StatTile';
import StatusBadge from '../components/ui/StatusBadge';
import Matricula from '../components/ui/Matricula';
import { Carregando, ErroCarregamento } from '../components/ui/Estados';
import { useToast } from '../components/ui/toast-context';
import { mensagemErro } from '../lib/erros';
import { diasEntre, formatDate } from '../lib/format';
import { horasTrabalhadas } from '../lib/calculos';

/** Etapas em que a viatura está fisicamente a ser trabalhada na oficina. */
const NA_OFICINA: EstadoProcesso[] = ['recepcao', 'diagnostico', 'orcamentacao', 'aguarda_aprovacao', 'em_reparacao', 'controlo_qualidade'];
/** Etapas em que o servidor aceita mudar o mecânico. */
const REATRIBUIVEL: EstadoProcesso[] = ['recepcao', 'diagnostico', 'orcamentacao', 'aguarda_aprovacao', 'em_reparacao'];

/** Horas orçamentadas de mão de obra ainda por fazer (aproximação: orçamentadas − trabalhadas). */
function horasPorFazer(p: ProcessoDetalhado) {
  if (p.estado !== 'em_reparacao') return 0;
  const orcadas = [...(p.orcamento?.maoObra ?? []), ...(p.orcamentosAdicionais ?? []).filter((a) => a.estado === 'aprovado').flatMap((a) => a.maoObra)]
    .reduce((s, m) => s + m.horas, 0);
  return Math.max(0, orcadas - horasTrabalhadas(p));
}

const prioridade = (p: ProcessoDetalhado) => (p.urgente ? 0 : 1) * 1e13 + new Date(p.prazoEntrega).getTime();

/**
 * Quadro da oficina: uma coluna por mecânico. Arrastar uma viatura para outra coluna (ou usar o menu
 * "Atribuir a" do cartão, em telemóvel e com teclado) muda o mecânico responsável.
 */
export default function Oficina() {
  const { can } = useAuth();
  const toast = useToast();
  const acao = useAcaoProcesso();
  const { data: processos, isPending, error, refetch } = useProcessos();
  const { data: utilizadores = [] } = useUtilizadores();
  const [sobre, setSobre] = useState<string | null>(null);
  const podeAtribuir = can('processos.atribuir');

  const mecanicos = utilizadores.filter((u) => u.perfil === 'mecanico' && u.ativo);
  const naOficina = useMemo(() => (processos ?? []).filter((p) => NA_OFICINA.includes(p.estado)).sort((a, b) => prioridade(a) - prioridade(b)), [processos]);

  if (isPending) return <Carregando />;
  if (error) return <ErroCarregamento erro={error} onRepetir={refetch} />;

  function atribuir(p: ProcessoDetalhado, mecanicoId: string) {
    if (p.mecanicoId === mecanicoId) return;
    const nome = mecanicos.find((m) => m.id === mecanicoId)?.nome;
    acao.mutate(() => api.processos.atribuirMecanico(p.id, mecanicoId), {
      onSuccess: () => toast(`${p.viatura.matricula} atribuída a ${nome}`),
      onError: (e) => toast(mensagemErro(e), 'erro'),
    });
  }

  const colunas: { id: string; mecanico?: Utilizador; itens: ProcessoDetalhado[] }[] = [
    { id: 'por-atribuir', itens: naOficina.filter((p) => !p.mecanicoId) },
    ...mecanicos.map((m) => ({ id: m.id, mecanico: m, itens: naOficina.filter((p) => p.mecanicoId === m.id) })),
  ];
  const aTrabalhar = (m: Utilizador) => naOficina.find((p) => (p.registosTempo ?? []).some((r) => !r.fim && r.mecanicoId === m.id));
  const totalHoras = naOficina.reduce((s, p) => s + horasPorFazer(p), 0);
  const ativosAgora = mecanicos.filter((m) => aTrabalhar(m)).length;

  return (
    <div className="pagina space-y-5">
      <PageHeader
        titulo="Oficina"
        descricao={podeAtribuir ? 'Carga de cada mecânico · arraste uma viatura para outro mecânico para a reatribuir' : 'Carga de cada mecânico'}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Viaturas em trabalho" value={String(naOficina.length)} hint="Da receção ao controlo de qualidade" />
        <StatTile label="Por atribuir" value={String(colunas[0].itens.length)} tom={colunas[0].itens.length ? 'aviso' : 'neutro'} hint="Sem mecânico responsável" />
        <StatTile label="A trabalhar agora" value={`${ativosAgora}/${mecanicos.length}`} hint="Mecânicos com cronómetro ativo" />
        <StatTile label="Horas orçamentadas por fazer" value={`${Math.round(totalHoras * 10) / 10} h`} hint="Reparações em curso" />
      </div>

      <div className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:-mx-8 lg:scroll-px-8 lg:px-8">
        {colunas.map((col) => {
          const horas = col.itens.reduce((s, p) => s + horasPorFazer(p), 0);
          const ativo = col.mecanico ? aTrabalhar(col.mecanico) : undefined;
          const recebe = podeAtribuir && !!col.mecanico;
          return (
            <section
              key={col.id}
              aria-label={col.mecanico?.nome ?? 'Por atribuir'}
              onDragOver={(e) => { if (recebe) { e.preventDefault(); setSobre(col.id); } }}
              onDragLeave={() => setSobre((s) => (s === col.id ? null : s))}
              onDrop={(e) => {
                setSobre(null);
                const p = naOficina.find((x) => x.id === e.dataTransfer.getData('text/plain'));
                if (p && col.mecanico) atribuir(p, col.mecanico.id);
              }}
              className={clsx(
                'w-[280px] shrink-0 snap-start rounded-lg border p-2 transition-colors',
                sobre === col.id ? 'border-mzd-black bg-zinc-100' : 'border-transparent'
              )}
            >
              <header className={clsx('mb-2 border-t-[3px] px-1 pt-2', col.mecanico ? 'border-mzd-black' : 'border-sinal-ambar')}>
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="truncate text-[13.5px] font-bold text-mzd-black">{col.mecanico?.nome ?? 'Por atribuir'}</h2>
                  <span className="num shrink-0 text-xs text-mzd-gray">{col.itens.length}</span>
                </div>
                {col.mecanico && (
                  <p className="mt-0.5 text-[11.5px] text-mzd-gray">
                    <span className="num">{Math.round(horas * 10) / 10} h</span> por fazer
                    {ativo ? (
                      <span className="ml-2 inline-flex items-center gap-1 font-semibold text-sinal-verde">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sinal-verde" /> em {ativo.viatura.matricula}
                      </span>
                    ) : (
                      <span className="ml-2">· sem cronómetro</span>
                    )}
                  </p>
                )}
              </header>
              <div className="space-y-2">
                {col.itens.map((p) => (
                  <Cartao key={p.id} p={p} mecanicos={mecanicos} podeAtribuir={podeAtribuir} onAtribuir={(id) => atribuir(p, id)} />
                ))}
                {col.itens.length === 0 && (
                  <p className="rounded-md border border-dashed border-linha-forte px-3 py-6 text-center text-xs text-mzd-gray">
                    {col.mecanico ? 'Sem viaturas atribuídas' : 'Todas as viaturas têm mecânico'}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Cartao({ p, mecanicos, podeAtribuir, onAtribuir }: { p: ProcessoDetalhado; mecanicos: Utilizador[]; podeAtribuir: boolean; onAtribuir: (id: string) => void }) {
  const late = diasEntre(p.prazoEntrega) > 0;
  const arrastavel = podeAtribuir && REATRIBUIVEL.includes(p.estado);
  const tarefas = p.tarefas ?? [];
  const feitas = tarefas.filter((t) => t.feita).length;
  const cronometro = (p.registosTempo ?? []).some((r) => !r.fim);
  return (
    <article
      draggable={arrastavel}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; }}
      className={clsx(
        'rounded-md border bg-superficie p-3',
        arrastavel && 'cursor-grab active:cursor-grabbing',
        late ? 'border-l-[3px] border-y-linha border-r-linha border-l-mzd-red' : 'border-linha'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link to={`/processos/${p.id}`} draggable={false}><Matricula valor={p.viatura.matricula} tamanho="sm" /></Link>
        <span className="flex items-center gap-1.5">
          {cronometro && <Timer size={13} className="text-sinal-verde" aria-label="Cronómetro ativo" />}
          {p.urgente && <span className="rotulo !text-sinal-vermelho">Urgente</span>}
        </span>
      </div>
      <Link to={`/processos/${p.id}`} draggable={false} className="mt-1.5 block truncate text-[13px] font-semibold text-mzd-black hover:underline">{p.viatura.marca} {p.viatura.modelo}</Link>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <StatusBadge estado={p.estado} className="!text-[10.5px]" />
        {p.aguardaPecas && <span className="rounded bg-sinal-ambar-fundo px-1.5 py-[3px] text-[10.5px] font-semibold text-sinal-ambar">Aguarda peças</span>}
        {p.aguardaPagamento && <span className="rounded bg-sinal-ambar-fundo px-1.5 py-[3px] text-[10.5px] font-semibold text-sinal-ambar">Aguarda pagamento</span>}
        {p.estado === 'recepcao' && !p.fichaRecepcao.assinaturaCliente && <span className="rounded bg-zinc-100 px-1.5 py-[3px] text-[10.5px] font-semibold text-mzd-gray">Ficha por digitalizar</span>}
      </div>
      {p.estado === 'em_reparacao' && tarefas.length > 0 && (
        <div className="mt-2">
          <div className="h-[4px] rounded-[1px] bg-zinc-100"><div className="h-full rounded-[1px] bg-mzd-black" style={{ width: `${(feitas / tarefas.length) * 100}%` }} /></div>
          <p className="num mt-1 text-[10.5px] text-mzd-gray">{feitas}/{tarefas.length} tarefas</p>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-linha/70 pt-2">
        <span className={clsx('num text-[11px]', late ? 'font-semibold text-sinal-vermelho' : 'text-mzd-gray')}>
          {late ? `+${diasEntre(p.prazoEntrega)}d · ` : ''}{formatDate(p.prazoEntrega).slice(0, 5)}
        </span>
        {arrastavel && (
          <select
            value={p.mecanicoId ?? ''}
            onChange={(e) => onAtribuir(e.target.value)}
            aria-label={`Atribuir ${p.viatura.matricula} a`}
            className="max-w-[130px] truncate rounded border border-linha bg-white px-1 py-0.5 text-[11px] text-mzd-gray"
          >
            <option value="" disabled>Atribuir a…</option>
            {mecanicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        )}
        {!arrastavel && p.estado === 'controlo_qualidade' && <span className="text-[10.5px] text-mzd-gray">{ESTADO_LABEL[p.estado]}</span>}
      </div>
    </article>
  );
}
