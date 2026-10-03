import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProcessos, useUtilizadores } from '../api/hooks';
import { Card, CardHeader } from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import StatTile from '../components/ui/StatTile';
import Kz from '../components/ui/Kz';
import { Table, Th, Tr, Td } from '../components/ui/Table';
import { Carregando, ErroCarregamento, Vazio } from '../components/ui/Estados';
import { calcularTotais } from '../lib/calculos';
import { estaAtivo } from '../types';

export default function Relatorios() {
  const { data: processos, isPending, error, refetch } = useProcessos();
  const { data: utilizadores = [] } = useUtilizadores();

  const dados = useMemo(() => {
    if (!processos) return null;
    const recusados = processos.filter((p) => p.orcamento?.estado === 'recusado');
    const contagem = new Map<string, number>();
    recusados.forEach((p) => {
      const motivo = p.orcamento!.motivoRecusa ?? 'Sem motivo registado';
      contagem.set(motivo, (contagem.get(motivo) ?? 0) + 1);
    });
    const motivosRecusa = [...contagem].map(([motivo, total]) => ({ motivo, total })).sort((a, b) => b.total - a.total);

    const totais = processos.filter((p) => p.fatura && p.orcamento).map((p) => calcularTotais(p.orcamento));
    const pecas = totais.reduce((s, t) => s + t.pecas, 0);
    const maoObra = totais.reduce((s, t) => s + t.maoObra, 0);

    const checklists = processos.filter((p) => p.checklistQualidade);
    const retrabalho = checklists.length
      ? Math.round((checklists.filter((p) => !p.checklistQualidade!.aprovado).length / checklists.length) * 100)
      : 0;

    const hoje = new Date();
    const garantiasAtivas = processos.filter((p) =>
      p.estado === 'entregue' && p.fatura && (p.garantias ?? []).some((g) => {
        const fim = new Date(p.fatura!.data);
        fim.setMonth(fim.getMonth() + g.prazoMeses);
        return fim >= hoje;
      })
    ).length;

    return {
      motivosRecusa,
      totalRecusados: recusados.length,
      pecas,
      maoObra,
      retrabalho,
      garantiasAtivas,
      entregues: processos.filter((p) => p.estado === 'entregue').length,
      cancelados: processos.filter((p) => p.estado === 'cancelado').length,
    };
  }, [processos]);

  if (isPending) return <Carregando />;
  if (error || !dados) return <ErroCarregamento erro={error} onRepetir={refetch} />;

  const maxMotivo = Math.max(1, ...dados.motivosRecusa.map((m) => m.total));
  const totalTipo = dados.pecas + dados.maoObra;
  const pctPecas = totalTipo ? Math.round((dados.pecas / totalTipo) * 100) : 0;

  return (
    <div className="pagina space-y-5">
      <PageHeader titulo="Relatórios" descricao="Indicadores de todo o histórico registado no sistema" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Retrabalho" value={`${dados.retrabalho}%`} tom={dados.retrabalho > 5 ? 'alerta' : 'neutro'} hint="Reprovações no controlo de qualidade" />
        <StatTile label="Viaturas entregues" value={String(dados.entregues)} to="/processos?estado=entregue" />
        <StatTile label="Processos cancelados" value={String(dados.cancelados)} hint="Inclui orçamentos recusados" to="/processos?estado=cancelado" />
        <StatTile label="Garantias ativas" value={String(dados.garantiasAtivas)} hint="Viaturas entregues ainda em garantia" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Porque é que os clientes recusam orçamentos" subtitle={`${dados.totalRecusados} orçamento(s) recusado(s), por motivo`} />
          {dados.motivosRecusa.length === 0 ? (
            <Vazio titulo="Ainda não há orçamentos recusados" />
          ) : (
            <ul className="space-y-3.5 px-5 py-5">
              {dados.motivosRecusa.map((m, i) => (
                <li key={m.motivo}>
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="font-medium text-mzd-black">{m.motivo}</span>
                    <span className="num text-mzd-gray">{m.total}</span>
                  </div>
                  <div className="mt-1.5 h-[7px] rounded-[1px] bg-zinc-100">
                    <div className={`h-full rounded-[1px] ${i === 0 ? 'bg-mzd-red' : 'bg-mzd-black'}`} style={{ width: `${(m.total / maxMotivo) * 100}%` }} />
                  </div>
                </li>
              ))}
              <li className="pt-1 text-xs text-mzd-gray">O motivo mais frequente aparece a vermelho.</li>
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="De onde vem a faturação" subtitle="Peças vs. mão de obra, sem IVA, em processos faturados" />
          {totalTipo === 0 ? (
            <Vazio titulo="Ainda não há faturas emitidas" />
          ) : (
            <div className="px-5 py-5">
              <div className="flex h-10 overflow-hidden rounded-[3px]" role="img" aria-label={`Peças ${pctPecas}%, mão de obra ${100 - pctPecas}%`}>
                <div className="flex items-center bg-mzd-black px-3 text-xs font-semibold text-white" style={{ width: `${pctPecas}%` }}>{pctPecas}%</div>
                <div className="flex flex-1 items-center justify-end bg-zinc-200 px-3 text-xs font-semibold text-mzd-black">{100 - pctPecas}%</div>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <dt className="flex items-center gap-2 text-[13px] font-medium text-mzd-black"><span className="h-2.5 w-2.5 rounded-[1px] bg-mzd-black" /> Peças</dt>
                  <dd className="mt-1 text-lg font-semibold"><Kz valor={dados.pecas} /></dd>
                </div>
                <div>
                  <dt className="flex items-center gap-2 text-[13px] font-medium text-mzd-black"><span className="h-2.5 w-2.5 rounded-[1px] bg-zinc-300" /> Mão de obra</dt>
                  <dd className="mt-1 text-lg font-semibold"><Kz valor={dados.maoObra} /></dd>
                </div>
              </dl>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Mecânicos" subtitle="Produtividade acumulada e carga atual" />
        <Table>
          <thead>
            <tr>
              <Th>Mecânico</Th>
              <Th direita>OS concluídas</Th>
              <Th direita>Tempo médio / OS</Th>
              <Th direita>Em curso</Th>
            </tr>
          </thead>
          <tbody>
            {utilizadores.filter((u) => u.perfil === 'mecanico').map((u) => {
              const emCurso = processos.filter((p) => p.mecanicoId === u.id && estaAtivo(p.estado)).length;
              return (
                <Tr key={u.id}>
                  <Td className="font-semibold text-mzd-black">{u.nome}</Td>
                  <Td direita num>{u.osConcluidas ?? '—'}</Td>
                  <Td direita num className="text-mzd-gray">{u.tempoMedioHoras ? `${u.tempoMedioHoras.toLocaleString('pt-PT')} h` : '—'}</Td>
                  <Td direita num>
                    <Link to="/processos?vista=lista" className="underline-offset-4 hover:underline">{emCurso}</Link>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
