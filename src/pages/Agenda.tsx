import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import clsx from 'clsx';
import { useConfiguracao, useMarcacoes, useProcessos } from '../api/hooks';
import { useAuth } from '../auth/useAuth';
import type { Marcacao, ProcessoDetalhado } from '../types';
import { TIPO_MARCACAO_LABEL, estaAtivo } from '../types';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import StatTile from '../components/ui/StatTile';
import Matricula from '../components/ui/Matricula';
import { Carregando, ErroCarregamento } from '../components/ui/Estados';
import { diaISO, horaCurta, inicioSemana, somarDias } from '../lib/datas';
import FormMarcacao from './agenda/FormMarcacao';
import DetalheMarcacao from './agenda/DetalheMarcacao';

const ESTILO_MARCACAO: Record<Marcacao['estado'], string> = {
  agendada: 'border-linha-forte border-dashed bg-white',
  confirmada: 'border-linha border-l-[3px] border-l-mzd-black bg-white',
  // Esbatido com cor (não com transparência, que tirava contraste ao texto).
  chegou: 'border-dashed border-linha-forte bg-zinc-50 [&_*]:!text-mzd-gray',
  faltou: 'border-linha bg-sinal-vermelho-fundo/50 line-through decoration-zinc-400',
  cancelada: 'border-dashed border-linha-forte bg-zinc-50 line-through decoration-zinc-400 [&_*]:!text-mzd-gray',
};

export default function Agenda() {
  const { can } = useAuth();
  const [refDate, setRefDate] = useState(() => new Date());
  const [params, setParams] = useSearchParams();
  // "?nova=1" (pesquisa global → Nova marcação) abre logo o formulário.
  const [novaNoDia, setNovaNoDia] = useState<string | null>(() => (params.get('nova') ? diaISO(new Date()) : null));
  const [aberta, setAberta] = useState<Marcacao | null>(null);
  const [aEditar, setAEditar] = useState<Marcacao | null>(null);

  const segunda = inicioSemana(refDate);
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(segunda, i));
  const de = diaISO(dias[0]);
  const ate = diaISO(dias[6]);
  const { data: marcacoes = [], isPending, error, refetch } = useMarcacoes(de, ate);
  const { data: processos = [] } = useProcessos();
  const { data: config } = useConfiguracao();
  const capacidade = config?.capacidadeDiaria ?? 6;
  const hoje = diaISO(new Date());

  const entregasPorDia = useMemo(() => {
    const map = new Map<string, ProcessoDetalhado[]>();
    processos.forEach((p) => {
      if (p.estado === 'cancelado') return;
      const k = diaISO(p.prazoEntrega);
      map.set(k, [...(map.get(k) ?? []), p]);
    });
    return map;
  }, [processos]);

  if (isPending) return <Carregando />;
  if (error) return <ErroCarregamento erro={error} onRepetir={refetch} />;

  const porDia = (d: string) => marcacoes.filter((m) => diaISO(m.data) === d);
  const ocupacao = (lista: Marcacao[]) => lista.filter((m) => m.estado !== 'cancelada' && m.estado !== 'faltou').length;
  const passadas = marcacoes.filter((m) => m.estado === 'chegou' || m.estado === 'faltou');
  const faltas = passadas.filter((m) => m.estado === 'faltou').length;
  const entregasSemana = dias.reduce((s, d) => s + (entregasPorDia.get(diaISO(d)) ?? []).filter((p) => estaAtivo(p.estado)).length, 0);
  const diasCheios = dias.filter((d) => ocupacao(porDia(diaISO(d))) >= capacidade).length;
  const mudarSemana = (n: number) => setRefDate((d) => somarDias(d, n * 7));
  const estaSemana = diaISO(inicioSemana(new Date())) === de;

  return (
    <div className="pagina space-y-5">
      <PageHeader
        titulo="Agenda"
        descricao={`Entradas marcadas e entregas prometidas · capacidade de ${capacidade} entradas por dia`}
        acoes={
          <>
            <div className="flex items-center gap-1.5">
              <Button variante="secundario" tamanho="sm" onClick={() => mudarSemana(-1)} aria-label="Semana anterior"><ChevronLeft size={15} /></Button>
              <span className="num min-w-40 text-center text-[13px] font-medium text-mzd-black">
                {dias[0].toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })} – {dias[6].toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
              </span>
              <Button variante="secundario" tamanho="sm" onClick={() => mudarSemana(1)} aria-label="Semana seguinte"><ChevronRight size={15} /></Button>
              {!estaSemana && <Button variante="fantasma" tamanho="sm" onClick={() => setRefDate(new Date())}>Hoje</Button>}
            </div>
            {can('agenda.gerir') && <Button icone={<Plus size={16} />} onClick={() => setNovaNoDia(hoje)}>Nova marcação</Button>}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Entradas marcadas" value={String(ocupacao(marcacoes))} hint="Nesta semana" />
        <StatTile label="Entregas prometidas" value={String(entregasSemana)} hint="Ainda por entregar" />
        <StatTile label="Dias cheios" value={String(diasCheios)} tom={diasCheios ? 'aviso' : 'neutro'} hint={`Com ${capacidade} ou mais entradas`} />
        <StatTile
          label="Faltas"
          value={passadas.length ? `${Math.round((faltas / passadas.length) * 100)}%` : '—'}
          tom={passadas.length && faltas / passadas.length > 0.15 ? 'alerta' : 'neutro'}
          hint={`${faltas} de ${passadas.length} marcações já passadas`}
        />
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-7">
        {dias.map((d) => {
          const k = diaISO(d);
          const lista = porDia(k);
          const ocupadas = ocupacao(lista);
          const entregas = entregasPorDia.get(k) ?? [];
          const ehHoje = k === hoje;
          const passado = k < hoje;
          const domingo = d.getDay() === 0;
          return (
            <section key={k} className={clsx('flex min-h-64 flex-col bg-superficie', domingo && '!bg-zinc-50')} aria-label={d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}>
              <header className={clsx('border-t-[3px] px-3 pb-2 pt-2.5', ehHoje ? 'border-mzd-red' : 'border-transparent')}>
                <div className="flex items-end justify-between">
                  <div>
                    <p className={clsx('rotulo', ehHoje && '!text-sinal-vermelho')}>{d.toLocaleDateString('pt-PT', { weekday: 'short' }).replace('.', '')}{ehHoje && ' · hoje'}</p>
                    <p className={clsx('font-display text-2xl font-extrabold leading-none tabular-nums [font-stretch:100%]', passado && !ehHoje ? 'text-mzd-gray' : 'text-mzd-black')}>{d.getDate()}</p>
                  </div>
                  {!domingo && <span className={clsx('num text-[11px]', ocupadas >= capacidade ? 'font-semibold text-sinal-vermelho' : 'text-mzd-gray')}>{ocupadas}/{capacidade}</span>}
                </div>
                {!domingo && (
                  <div className="mt-2 flex h-[4px] gap-[2px]" aria-hidden>
                    {Array.from({ length: Math.max(capacidade, ocupadas) }, (_, i) => (
                      <span key={i} className={clsx('flex-1 rounded-[1px]', i < ocupadas ? (i >= capacidade ? 'bg-mzd-red' : 'bg-mzd-black') : 'bg-zinc-200')} />
                    ))}
                  </div>
                )}
              </header>

              <div className="flex-1 space-y-1.5 px-2 pb-2">
                {domingo ? (
                  <p className="py-6 text-center text-[11.5px] text-mzd-gray">Fechado</p>
                ) : (
                  <>
                    {lista.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setAberta(m)}
                        className={clsx('block w-full rounded-md border p-2 text-left transition-colors hover:border-zinc-400', ESTILO_MARCACAO[m.estado])}
                      >
                        <span className="flex items-baseline justify-between gap-1">
                          <span className="num text-[12px] font-semibold text-mzd-black">{horaCurta(m.data)}</span>
                          <span className="text-[10.5px] text-mzd-gray">{TIPO_MARCACAO_LABEL[m.tipo]}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-medium text-mzd-black">{m.nome}</span>
                        {m.matricula && <span className="num block text-[10.5px] text-mzd-gray">{m.matricula}</span>}
                        {m.estado === 'agendada' && <span className="rotulo mt-1 block !text-[9.5px]">Por confirmar</span>}
                        {m.estado === 'faltou' && <span className="rotulo mt-1 block !text-[9.5px] !text-sinal-vermelho no-underline">Faltou</span>}
                      </button>
                    ))}
                    {can('agenda.gerir') && !passado && (
                      <button
                        type="button"
                        onClick={() => setNovaNoDia(k)}
                        className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-transparent py-1.5 text-[11px] text-mzd-gray transition-colors hover:border-linha-forte hover:text-mzd-black"
                        aria-label={`Nova marcação em ${d.toLocaleDateString('pt-PT')}`}
                      >
                        <Plus size={12} /> Marcar
                      </button>
                    )}
                  </>
                )}

                {entregas.length > 0 && (
                  <div className="border-t border-linha pt-2">
                    <p className="rotulo mb-1 px-0.5">Entregas</p>
                    {entregas.map((p) => {
                      const emFalta = passado && estaAtivo(p.estado);
                      return (
                        <Link
                          key={p.id}
                          to={`/processos/${p.id}`}
                          className={clsx('mb-1 flex items-center gap-1.5 rounded px-1 py-1 hover:bg-zinc-50', !estaAtivo(p.estado) && '[&_*]:!text-mzd-gray')}
                          title={`${p.cliente.nome} · ${p.numero}`}
                        >
                          <Matricula valor={p.viatura.matricula} tamanho="sm" />
                          {emFalta && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mzd-red" aria-label="Atrasada" />}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-mzd-gray">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-dashed border-linha-forte" /> Por confirmar</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-linha border-l-[3px] border-l-mzd-black" /> Confirmada</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-mzd-red" /> Entrega atrasada</span>
      </p>

      {novaNoDia && <FormMarcacao diaInicial={novaNoDia} onFechar={() => { setNovaNoDia(null); if (params.get('nova')) setParams({}, { replace: true }); }} />}
      {aEditar && <FormMarcacao marcacao={aEditar} onFechar={() => setAEditar(null)} />}
      {aberta && <DetalheMarcacao marcacao={aberta} onFechar={() => setAberta(null)} onEditar={() => { setAEditar(aberta); setAberta(null); }} />}
    </div>
  );
}
