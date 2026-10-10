import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { List, Columns3, Plus, X } from 'lucide-react';
import clsx from 'clsx';
import { useProcessos } from '../api/hooks';
import { useAuth } from '../auth/useAuth';
import type { EstadoProcesso, ProcessoDetalhado } from '../types';
import { ESTADOS_ATIVOS, ESTADOS_ORDEM, ESTADO_LABEL, estaAtivo } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import StageTrack from '../components/ui/StageTrack';
import Matricula from '../components/ui/Matricula';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import { SearchInput, Segmented } from '../components/ui/Controls';
import { Select } from '../components/ui/Form';
import { Card } from '../components/ui/Card';
import { Table, Th, Tr, Td, LinhaVazia } from '../components/ui/Table';
import { Carregando, ErroCarregamento } from '../components/ui/Estados';
import { diasEntre, formatDate, formatAOA } from '../lib/format';
import { calcularTotais } from '../lib/calculos';
import { TOM_ESTADO } from '../lib/estados';

const FILTRO_ESTADOS: EstadoProcesso[] = [...ESTADOS_ORDEM, 'cancelado'];
const FILTROS_RAPIDOS = {
  atrasados: 'Prazo ultrapassado',
  pecas: 'À espera de peças',
  urgentes: 'Urgentes',
} as const;
type FiltroRapido = keyof typeof FILTROS_RAPIDOS;

const atrasado = (p: ProcessoDetalhado) => estaAtivo(p.estado) && diasEntre(p.prazoEntrega) > 0;

export default function Processos() {
  // Os filtros vivem no endereço: o painel pode abrir esta página já filtrada e o link pode ser partilhado.
  const [params, setParams] = useSearchParams();
  const estadoParam = params.get('estado') as EstadoProcesso | null;
  const filtroParam = params.get('filtro') as FiltroRapido | null;
  const filtroEstado = estadoParam && FILTRO_ESTADOS.includes(estadoParam) ? estadoParam : 'todos';
  const filtroRapido = filtroParam && filtroParam in FILTROS_RAPIDOS ? filtroParam : null;
  const view = params.get('vista') === 'lista' || filtroEstado === 'entregue' || filtroEstado === 'cancelado' ? 'lista' : 'quadro';

  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data: processos, isPending, error, refetch } = useProcessos();

  function definir(chave: string, valor: string | null) {
    const p = new URLSearchParams(params);
    if (valor) p.set(chave, valor);
    else p.delete(chave);
    setParams(p, { replace: true });
  }

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (processos ?? []).filter((p) => {
      if (q && !(p.numero.toLowerCase().includes(q) || p.viatura.matricula.toLowerCase().includes(q) || p.cliente.nome.toLowerCase().includes(q))) return false;
      if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false;
      if (filtroRapido === 'atrasados' && !atrasado(p)) return false;
      if (filtroRapido === 'pecas' && !(p.aguardaPecas && estaAtivo(p.estado))) return false;
      if (filtroRapido === 'urgentes' && !(p.urgente && estaAtivo(p.estado))) return false;
      return true;
    });
  }, [processos, query, filtroEstado, filtroRapido]);

  const ativosVisiveis = filtrados.filter((p) => estaAtivo(p.estado)).length;

  return (
    <div className="pagina space-y-5">
      <PageHeader
        titulo="Processos"
        descricao={processos ? `${ativosVisiveis} na oficina · ${filtrados.length} no filtro atual` : 'A carregar…'}
        acoes={can('processos.criar') && <Button variante="perigo" icone={<Plus size={16} />} onClick={() => navigate('/processos/novo')}>Nova receção</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Matrícula, cliente ou nº OS" label="Pesquisar processos" className="sm:w-72" />
        <Select
          value={filtroEstado}
          onChange={(e) => definir('estado', e.target.value === 'todos' ? null : e.target.value)}
          aria-label="Filtrar por etapa"
          className="w-full sm:w-52"
        >
          <option value="todos">Todas as etapas</option>
          {FILTRO_ESTADOS.map((e) => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
        </Select>
        {(Object.keys(FILTROS_RAPIDOS) as FiltroRapido[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => definir('filtro', filtroRapido === f ? null : f)}
            aria-pressed={filtroRapido === f}
            className={clsx(
              'flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition-colors',
              filtroRapido === f ? 'border-mzd-black bg-mzd-black text-white' : 'border-linha-forte bg-white text-mzd-gray hover:text-mzd-black'
            )}
          >
            {FILTROS_RAPIDOS[f]}
            {filtroRapido === f && <X size={12} />}
          </button>
        ))}

        <div className="ml-auto">
          <Segmented
            label="Modo de visualização"
            value={view}
            onChange={(v) => definir('vista', v === 'lista' ? 'lista' : null)}
            opcoes={[
              { valor: 'quadro', label: 'Quadro', icone: <Columns3 size={14} /> },
              { valor: 'lista', label: 'Lista', icone: <List size={14} /> },
            ]}
          />
        </div>
      </div>

      {isPending ? (
        <Carregando />
      ) : error ? (
        <ErroCarregamento erro={error} onRepetir={refetch} />
      ) : view === 'quadro' ? (
        <Quadro processos={filtrados} />
      ) : (
        <ListaTabela processos={filtrados} verValores={can('valores.ver')} />
      )}

    </div>
  );
}

function Quadro({ processos: lista }: { processos: ProcessoDetalhado[] }) {
  return (
    <div className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:-mx-8 lg:scroll-px-8 lg:px-8">
      {ESTADOS_ATIVOS.map((estado, i) => {
        const itens = lista.filter((p) => p.estado === estado);
        const tom = TOM_ESTADO[estado];
        return (
          <section key={estado} className="w-[264px] shrink-0 snap-start" aria-label={ESTADO_LABEL[estado]}>
            <header
              className={clsx(
                'mb-2 flex items-center gap-2 border-t-[3px] pt-2',
                tom === 'espera' ? 'border-sinal-ambar' : tom === 'pronto' ? 'border-sinal-verde' : 'border-mzd-black'
              )}
            >
              <span className="num text-[11px] text-mzd-gray">{String(i + 1).padStart(2, '0')}</span>
              <h2 className="text-[12.5px] font-bold text-mzd-black">{ESTADO_LABEL[estado]}</h2>
              <span className="num ml-auto text-xs font-semibold text-mzd-gray">{itens.length}</span>
            </header>
            <div className="space-y-2">
              {itens.map((p) => <CartaoProcesso key={p.id} p={p} />)}
              {itens.length === 0 && (
                <p className="rounded-md border border-dashed border-linha-forte px-3 py-6 text-center text-xs text-mzd-gray">Nenhuma viatura nesta etapa</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CartaoProcesso({ p }: { p: ProcessoDetalhado }) {
  const late = atrasado(p);
  return (
    <Link
      to={`/processos/${p.id}`}
      className={clsx(
        'relative block rounded-md border bg-superficie p-3 transition-colors hover:border-zinc-400',
        late ? 'border-l-[3px] border-y-linha border-r-linha border-l-mzd-red' : 'border-linha'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Matricula valor={p.viatura.matricula} tamanho="sm" />
        {p.urgente && <span className="rotulo !text-sinal-vermelho">Urgente</span>}
      </div>
      <p className="mt-2 truncate text-[13px] font-semibold text-mzd-black">{p.viatura.marca} {p.viatura.modelo}</p>
      <p className="truncate text-xs text-mzd-gray">{p.cliente.nome}</p>
      {p.aguardaPecas && (
        <p className="mt-2 inline-block rounded bg-sinal-ambar-fundo px-1.5 py-0.5 text-[11px] font-semibold text-sinal-ambar">Aguarda peças</p>
      )}
      {p.aguardaPagamento && (
        <p className="mt-2 inline-block rounded bg-sinal-ambar-fundo px-1.5 py-0.5 text-[11px] font-semibold text-sinal-ambar">Aguarda pagamento</p>
      )}
      <div className="mt-2.5 flex items-center justify-between border-t border-linha/70 pt-2 text-[11.5px]">
        <span className="num text-mzd-gray">{p.numero}</span>
        <span className={clsx('num', late ? 'font-semibold text-sinal-vermelho' : 'text-mzd-gray')}>
          {late ? `+${diasEntre(p.prazoEntrega)}d · ` : ''}{formatDate(p.prazoEntrega).slice(0, 5)}
        </span>
      </div>
    </Link>
  );
}

function ListaTabela({ processos: lista, verValores }: { processos: ProcessoDetalhado[]; verValores: boolean }) {
  const ordenada = [...lista].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  return (
    <Card>
      <Table>
        <thead>
          <tr>
            <Th>Viatura</Th>
            <Th>Cliente</Th>
            <Th>Mecânico</Th>
            <Th className="w-44">Etapa</Th>
            {verValores && <Th direita>Orçamento</Th>}
            <Th>Prazo</Th>
          </tr>
        </thead>
        <tbody>
          {ordenada.map((p) => {
            const late = atrasado(p);
            return (
              <Tr key={p.id}>
                <Td>
                  <Link to={`/processos/${p.id}`} className="group flex items-center gap-2.5">
                    <Matricula valor={p.viatura.matricula} tamanho="sm" />
                    <span>
                      <span className="block font-semibold text-mzd-black group-hover:underline">{p.viatura.marca} {p.viatura.modelo}</span>
                      <span className="num block text-[11.5px] text-mzd-gray">{p.numero}{p.urgente && <span className="font-sans font-semibold text-sinal-vermelho"> · Urgente</span>}</span>
                    </span>
                  </Link>
                </Td>
                <Td className="text-mzd-black">{p.cliente.nome}</Td>
                <Td className="text-mzd-gray">{p.mecanico?.nome ?? '—'}</Td>
                <Td>
                  <StatusBadge estado={p.estado} />
                  <StageTrack estado={p.estado} estadoAnterior={p.cancelamento?.estadoAnterior} atrasado={late} className="mt-1.5 w-36" />
                </Td>
                {verValores && <Td direita num className="text-mzd-gray">{p.orcamento ? formatAOA(calcularTotais(p.orcamento).total) : '—'}</Td>}
                <Td num className={late ? 'font-semibold text-sinal-vermelho' : 'text-mzd-gray'}>{formatDate(p.prazoEntrega)}</Td>
              </Tr>
            );
          })}
          {lista.length === 0 && <LinhaVazia colunas={6}>Nenhum processo corresponde aos filtros.</LinhaVazia>}
        </tbody>
      </Table>
    </Card>
  );
}
