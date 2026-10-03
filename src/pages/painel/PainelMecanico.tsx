import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pause, Play, PackageX } from 'lucide-react';
import clsx from 'clsx';
import { useAcaoProcesso, useProcessos } from '../../api/hooks';
import { api } from '../../api/endpoints';
import { useAuth } from '../../auth/useAuth';
import type { ProcessoDetalhado } from '../../types';
import { ESTADO_LABEL } from '../../types';
import Button from '../../components/ui/Button';
import { botao } from '../../components/ui/botao';
import Matricula from '../../components/ui/Matricula';
import StatTile from '../../components/ui/StatTile';
import { Carregando, ErroCarregamento, Vazio } from '../../components/ui/Estados';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';
import { diasEntre, formatDate } from '../../lib/format';
import { inicioSemana } from '../../lib/datas';

function duracao(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
}

const URGENCIA_ORDEM = { seguranca: 0, alto: 1, medio: 2, baixo: 3 } as const;

/** Painel do mecânico, pensado para o telemóvel: o trabalho dele, por ordem, com o cronómetro à mão. */
export default function PainelMecanico() {
  const { user } = useAuth();
  const toast = useToast();
  const acao = useAcaoProcesso();
  const { data: processos, isPending, error, refetch } = useProcessos();
  const [agora, setAgora] = useState(() => Date.now());

  const meus = (processos ?? []).filter((p) => p.mecanicoId === user?.id);
  const ativo = meus.find((p) => (p.registosTempo ?? []).some((r) => !r.fim && r.mecanicoId === user?.id));
  const registoAtivo = ativo?.registosTempo?.find((r) => !r.fim && r.mecanicoId === user?.id);

  useEffect(() => {
    if (!registoAtivo) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [registoAtivo]);

  if (isPending) return <Carregando />;
  if (error) return <ErroCarregamento erro={error} onRepetir={refetch} />;

  const ordenar = (a: ProcessoDetalhado, b: ProcessoDetalhado) =>
    Number(b.urgente) - Number(a.urgente) ||
    (URGENCIA_ORDEM[a.diagnostico?.urgencia ?? 'baixo'] - URGENCIA_ORDEM[b.diagnostico?.urgencia ?? 'baixo']) ||
    a.prazoEntrega.localeCompare(b.prazoEntrega);
  const agoraLista = meus.filter((p) => p.estado === 'diagnostico' || p.estado === 'em_reparacao').sort(ordenar);
  const aEspera = meus.filter((p) => ['recepcao', 'orcamentacao', 'aguarda_aprovacao', 'controlo_qualidade'].includes(p.estado));

  const segunda = inicioSemana(new Date()).getTime();
  const horasSemana = meus.flatMap((p) => p.registosTempo ?? [])
    .filter((r) => r.mecanicoId === user?.id && new Date(r.inicio).getTime() >= segunda)
    .reduce((s, r) => s + ((r.fim ? new Date(r.fim).getTime() : agora) - new Date(r.inicio).getTime()), 0) / 3_600_000;
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const concluidasMes = meus.filter((p) => p.historico.some((h) => h.estado === 'controlo_qualidade' && h.data >= inicioMes)).length;

  const cronometro = (p: ProcessoDetalhado, acaoCron: 'iniciar' | 'parar') =>
    acao.mutate(() => api.processos.cronometro(p.id, acaoCron), {
      onSuccess: () => toast(acaoCron === 'iniciar' ? `A trabalhar em ${p.viatura.matricula}` : 'Cronómetro parado'),
      onError: (e) => toast(mensagemErro(e), 'erro'),
    });

  return (
    <div className="pagina mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold text-mzd-black">As minhas tarefas</h1>
        <p className="mt-1 text-sm text-mzd-gray first-letter:uppercase">
          {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })} · {agoraLista.length} viatura(s) para trabalhar
        </p>
      </header>

      {ativo && registoAtivo && (
        <section className="rounded-lg bg-mzd-black p-4 text-white" aria-label="Trabalho em curso">
          <p className="rotulo !text-zinc-400">A trabalhar agora</p>
          <Link to={`/processos/${ativo.id}`} className="mt-1.5 flex flex-wrap items-center gap-2 hover:underline">
            <Matricula valor={ativo.viatura.matricula} tamanho="sm" />
            <span className="font-semibold">{ativo.viatura.marca} {ativo.viatura.modelo}</span>
          </Link>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="num text-3xl font-semibold tabular-nums">{duracao(agora - new Date(registoAtivo.inicio).getTime())}</span>
            <Button variante="perigo" icone={<Pause size={15} />} onClick={() => cronometro(ativo, 'parar')} carregando={acao.isPending}>Parar</Button>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Horas esta semana" value={`${(Math.round(horasSemana * 10) / 10).toLocaleString('pt-PT')} h`} hint="Registadas no cronómetro" />
        <StatTile label="Reparações este mês" value={String(concluidasMes)} hint="Que passaram ao controlo de qualidade" />
      </div>

      <section>
        <h2 className="rotulo mb-2">Para trabalhar</h2>
        {agoraLista.length === 0 ? (
          <div className="rounded-lg border border-linha bg-superficie"><Vazio titulo="Sem viaturas atribuídas">Quando o chefe de oficina lhe atribuir uma viatura, aparece aqui.</Vazio></div>
        ) : (
          <ul className="space-y-2.5">
            {agoraLista.map((p) => {
              const late = diasEntre(p.prazoEntrega) > 0;
              const tarefas = p.tarefas ?? [];
              const feitas = tarefas.filter((t) => t.feita).length;
              const meuAqui = p.id === ativo?.id;
              return (
                <li key={p.id} className={clsx('rounded-lg border bg-superficie p-4', late ? 'border-l-[3px] border-y-linha border-r-linha border-l-mzd-red' : 'border-linha')}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link to={`/processos/${p.id}`} className="flex flex-wrap items-center gap-2.5">
                      <Matricula valor={p.viatura.matricula} />
                      <span className="font-semibold text-mzd-black">{p.viatura.marca} {p.viatura.modelo}</span>
                    </Link>
                    <span className="flex items-center gap-2">
                      {p.urgente && <span className="rotulo !text-sinal-vermelho">Urgente</span>}
                      <span className={clsx('num text-xs', late ? 'font-semibold text-sinal-vermelho' : 'text-mzd-gray')}>
                        {late ? `atrasada ${diasEntre(p.prazoEntrega)}d` : `até ${formatDate(p.prazoEntrega).slice(0, 5)}`}
                      </span>
                    </span>
                  </div>

                  {p.estado === 'diagnostico' ? (
                    <p className="mt-2 text-[13.5px] text-mzd-black">“{p.fichaRecepcao.queixaCliente}”</p>
                  ) : (
                    <div className="mt-3">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-semibold text-mzd-black">{ESTADO_LABEL[p.estado]}</span>
                        <span className="num text-mzd-gray">{feitas}/{tarefas.length} tarefas</span>
                      </div>
                      <div className="mt-1.5 h-[6px] rounded-[1px] bg-zinc-100">
                        <div className="h-full rounded-[1px] bg-mzd-black" style={{ width: `${tarefas.length ? (feitas / tarefas.length) * 100 : 0}%` }} />
                      </div>
                    </div>
                  )}
                  {p.aguardaPecas && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-sinal-ambar"><PackageX size={13} /> À espera de peças: {p.notaPecas}</p>
                  )}

                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    {p.estado === 'em_reparacao' && !p.aguardaPecas && (
                      meuAqui
                        ? <Button variante="perigo" tamanho="sm" icone={<Pause size={14} />} onClick={() => cronometro(p, 'parar')}>Parar</Button>
                        : <Button variante="secundario" tamanho="sm" icone={<Play size={14} />} onClick={() => cronometro(p, 'iniciar')} disabled={!!ativo}>Iniciar trabalho</Button>
                    )}
                    <Link to={`/processos/${p.id}`} className={botao('primario', 'sm')}>
                      {p.estado === 'diagnostico' ? (p.diagnostico?.itens.length ? 'Continuar diagnóstico' : 'Fazer diagnóstico') : 'Ver tarefas'}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {aEspera.length > 0 && (
        <section>
          <h2 className="rotulo mb-2">À espera de outros</h2>
          <ul className="divide-y divide-linha/70 rounded-lg border border-linha bg-superficie">
            {aEspera.map((p) => (
              <li key={p.id}>
                <Link to={`/processos/${p.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                  <Matricula valor={p.viatura.matricula} tamanho="sm" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-mzd-black">{p.viatura.marca} {p.viatura.modelo}</span>
                  <span className="text-xs text-mzd-gray">
                    {p.estado === 'aguarda_aprovacao' ? 'Aguarda o cliente' : p.estado === 'orcamentacao' ? 'Em orçamentação' : p.estado === 'controlo_qualidade' ? 'No controlo de qualidade' : 'Na receção'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
