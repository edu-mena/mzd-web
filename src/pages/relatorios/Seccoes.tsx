import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Relatorio } from '../../types';
import { ESTADO_LABEL } from '../../types';
import { Table, Th, Tr, Td } from '../../components/ui/Table';
import { Vazio } from '../../components/ui/Estados';
import { COR, eixo, milhares, tooltip } from '../../lib/graficos';
import { formatAOA, formatarIndicador } from '../../lib/format';
import { descarregarCsv } from '../../lib/csv';
import { Barras, Bloco, Indicador } from './Indicador';

const nomeMes = (mes: string) => new Date(`${mes}-15T12:00:00`).toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '');
const horas = (h: number) => (h >= 48 ? `${(Math.round((h / 24) * 10) / 10).toLocaleString('pt-PT')} dias` : `${Math.round(h).toLocaleString('pt-PT')} h`);
const ficheiro = (r: Relatorio, nome: string) => `mzd-${nome}-${r.periodo.de}-a-${r.periodo.ate}`;

export function Negocio({ r }: { r: Relatorio }) {
  const n = r.negocio!;
  const vendido = n.pecas + n.maoObra;
  const margem = n.margemPecas ? Math.round(((n.margemPecas.venda - n.margemPecas.custo) / n.margemPecas.venda) * 1000) / 10 : null;
  const noPeriodo = (mes: string) => mes >= r.periodo.de.slice(0, 7) && mes <= r.periodo.ate.slice(0, 7);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Indicador label="Faturado" valor={n.faturado} formato="kz" />
        <Indicador label="Recebido" valor={n.recebido} formato="kz" nota="Pagamentos e adiantamentos, sem anulados" />
        <Indicador label="Valor médio por fatura" valor={n.ticketMedio} formato="kz" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Bloco
          titulo="Faturação por mês"
          subtitulo="Últimos 12 meses · a tinta, os meses do período escolhido · Kz com IVA"
          className="xl:col-span-2"
          onExportar={() => descarregarCsv(ficheiro(r, 'faturacao-mensal'), ['Mês', 'Faturado (Kz)', 'Recebido (Kz)'], n.porMes.map((m) => [m.mes, m.faturado, m.recebido]))}
        >
          <div className="h-64 px-2 pb-3 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={n.porMes} margin={{ left: 4, right: 16 }}>
                <CartesianGrid vertical={false} stroke={COR.grelha} />
                <XAxis dataKey="mes" tickFormatter={nomeMes} {...eixo} />
                <YAxis tickFormatter={milhares} {...eixo} axisLine={false} width={44} />
                <Tooltip
                  labelFormatter={(m) => new Date(`${m}-15T12:00:00`).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
                  formatter={(v, nome) => [formatAOA(Number(v)), nome]}
                  {...tooltip}
                />
                <Bar dataKey="faturado" name="Faturado" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {n.porMes.map((m) => <Cell key={m.mes} fill={noPeriodo(m.mes) ? COR.tinta : COR.tintaSuave} fillOpacity={noPeriodo(m.mes) ? 1 : 0.4} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Bloco>
        <Bloco titulo="De onde vem a faturação" subtitulo="Processos faturados no período, sem IVA">
          <dl className="divide-y divide-linha/70">
            <div className="px-5 py-3.5">
              <dt className="rotulo">Peças</dt>
              <dd className="mt-1 flex items-baseline justify-between"><span className="num text-lg font-semibold">{formatAOA(n.pecas)}</span><span className="num text-xs text-mzd-gray">{vendido ? Math.round((n.pecas / vendido) * 100) : 0}%</span></dd>
            </div>
            <div className="px-5 py-3.5">
              <dt className="rotulo">Mão de obra</dt>
              <dd className="mt-1 flex items-baseline justify-between"><span className="num text-lg font-semibold">{formatAOA(n.maoObra)}</span><span className="num text-xs text-mzd-gray">{vendido ? Math.round((n.maoObra / vendido) * 100) : 0}%</span></dd>
            </div>
            <div className="px-5 py-3.5">
              <dt className="rotulo">Descontos concedidos</dt>
              <dd className="num mt-1 text-lg font-semibold">{formatAOA(n.descontos)}</dd>
            </div>
            {margem !== null && (
              <div className="px-5 py-3.5">
                <dt className="rotulo">Margem bruta nas peças</dt>
                <dd className="mt-1 flex items-baseline justify-between">
                  <span className="num text-lg font-semibold">{formatAOA(n.margemPecas!.venda - n.margemPecas!.custo)}</span>
                  <span className={`num text-xs font-semibold ${margem < 20 ? 'text-sinal-vermelho' : 'text-mzd-gray'}`}>{margem.toLocaleString('pt-PT')}%</span>
                </dd>
                <dd className="mt-0.5 text-[11px] text-mzd-gray">Ao custo médio atual de cada peça</dd>
              </div>
            )}
          </dl>
        </Bloco>
      </div>
    </div>
  );
}

export function Operacao({ r }: { r: Relatorio }) {
  const o = r.operacao;
  const etapas = o.tempoPorEtapa.filter((e) => e.n > 0);
  // Gargalo: a etapa interna mais demorada (a espera pelo cliente não depende da oficina).
  const internas = etapas.filter((e) => e.estado !== 'aguarda_aprovacao');
  const gargalo = internas.reduce<typeof internas[number] | null>((m, e) => (!m || e.mediaHoras > m.mediaHoras ? e : m), null);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Indicador label="Entradas" valor={o.entradas} formato="n" />
        <Indicador label="Entregas" valor={o.entregas} formato="n" />
        <Indicador label="Cumprimento de prazo" valor={o.cumprimentoPrazo} formato="pct" nota="Entregues até à data prometida" />
        <Indicador label="Tempo médio na oficina" valor={o.cicloMedioDias} formato="dias" melhor="menos" nota="Da receção à entrega" />
        <Indicador label="Retrabalho" valor={o.retrabalhoPct} formato="pct" melhor="menos" nota="Voltaram à reparação no controlo de qualidade" />
        <Indicador label="Aprovação de orçamentos" valor={o.aprovacaoPct} formato="pct" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Bloco
          titulo="Onde as viaturas passam mais tempo"
          subtitulo={gargalo ? `Tempo médio em cada etapa · a vermelho, a etapa interna mais demorada (${ESTADO_LABEL[gargalo.estado]})` : 'Tempo médio em cada etapa'}
          className="xl:col-span-2"
          onExportar={() => descarregarCsv(ficheiro(r, 'tempo-por-etapa'), ['Etapa', 'Tempo médio (h)', 'Passagens'], o.tempoPorEtapa.map((e) => [ESTADO_LABEL[e.estado], e.mediaHoras, e.n]))}
        >
          {etapas.length === 0 ? <Vazio titulo="Sem movimento no período" /> : (
            <Barras itens={etapas.map((e) => ({
              rotulo: `${ESTADO_LABEL[e.estado]}${e.estado === 'aguarda_aprovacao' ? ' (espera pelo cliente)' : ''}`,
              valor: e.mediaHoras,
              destaque: e.estado === gargalo?.estado,
              detalhe: `${horas(e.mediaHoras)} · ${e.n} passage${e.n === 1 ? 'm' : 'ns'}`,
            }))} />
          )}
          {o.respostaClienteHoras !== null && (
            <p className="border-t border-linha/70 px-5 py-3 text-xs text-mzd-gray">
              Os clientes respondem ao orçamento, a meio, em <strong className="text-mzd-black">{horas(o.respostaClienteHoras)}</strong> (mediana).
            </p>
          )}
        </Bloco>
        <Bloco
          titulo="Porque recusam orçamentos"
          subtitulo="Orçamentos recusados no período"
          onExportar={o.motivosRecusa.length ? () => descarregarCsv(ficheiro(r, 'motivos-recusa'), ['Motivo', 'Total'], o.motivosRecusa.map((m) => [m.motivo, m.total])) : undefined}
        >
          {o.motivosRecusa.length === 0 ? <Vazio titulo="Nenhuma recusa no período" /> : <Barras itens={o.motivosRecusa.map((m) => ({ rotulo: m.motivo, valor: m.total }))} />}
        </Bloco>
      </div>
    </div>
  );
}

export function Equipa({ r }: { r: Relatorio }) {
  const comValores = r.equipa.some((m) => m.maoObraFaturada !== undefined);
  const eficiencia = (m: Relatorio['equipa'][number]) => (m.horasTrabalhadas ? Math.round((m.horasFaturadas / m.horasTrabalhadas) * 100) : null);
  return (
    <Bloco
      titulo="Mecânicos"
      subtitulo="Processos entregues no período · eficiência = horas vendidas ao cliente ÷ horas registadas no cronómetro"
      onExportar={() => descarregarCsv(ficheiro(r, 'equipa'),
        ['Mecânico', 'Entregues', 'Horas registadas', 'Horas vendidas', 'Eficiência (%)', 'Retrabalhos', ...(comValores ? ['Mão de obra faturada (Kz)'] : [])],
        r.equipa.map((m) => [m.nome, m.concluidos, m.horasTrabalhadas, m.horasFaturadas, eficiencia(m), m.retrabalhos, ...(comValores ? [m.maoObraFaturada ?? 0] : [])]))}
    >
      <Table>
        <thead>
          <tr>
            <Th>Mecânico</Th><Th direita>Entregues</Th><Th direita>Horas registadas</Th><Th direita>Horas vendidas</Th><Th direita>Eficiência</Th><Th direita>Retrabalhos</Th>
            {comValores && <Th direita>Mão de obra faturada</Th>}
          </tr>
        </thead>
        <tbody>
          {r.equipa.map((m) => {
            const e = eficiencia(m);
            return (
              <Tr key={m.mecanicoId}>
                <Td className="font-semibold text-mzd-black">{m.nome}</Td>
                <Td direita num>{m.concluidos}</Td>
                <Td direita num>{m.horasTrabalhadas.toLocaleString('pt-PT')} h</Td>
                <Td direita num>{m.horasFaturadas.toLocaleString('pt-PT')} h</Td>
                <Td direita num className={e !== null && e < 70 ? 'font-semibold text-sinal-vermelho' : ''}>{e === null ? '—' : `${e}%`}</Td>
                <Td direita num className={m.retrabalhos ? 'font-semibold text-sinal-vermelho' : 'text-mzd-gray'}>{m.retrabalhos}</Td>
                {comValores && <Td direita num>{formatAOA(m.maoObraFaturada ?? 0)}</Td>}
              </Tr>
            );
          })}
        </tbody>
      </Table>
      <p className="border-t border-linha/70 px-5 py-3 text-xs text-mzd-gray">
        Sem cronómetro registado, a eficiência fica em branco. Abaixo de 70%, o tempo gasto está muito acima do orçamentado: rever orçamentos ou o processo de trabalho.
      </p>
    </Bloco>
  );
}

export function Clientes({ r }: { r: Relatorio }) {
  const c = r.clientes;
  const comValores = c.top.some((x) => x.faturado !== undefined);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Indicador label="Clientes novos" valor={c.novos} formato="n" />
        <div className="rounded-lg border border-linha bg-superficie px-4 py-3.5">
          <p className="rotulo">Clientes que voltaram</p>
          <p className="mt-1.5 font-display text-[1.6rem] font-extrabold leading-none tabular-nums text-mzd-black">{formatarIndicador(c.recorrentesPct, 'pct')}</p>
          <p className="mt-2 text-xs text-mzd-gray">Dos clientes com entradas no período, já tinham vindo antes</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Bloco
          titulo="Principais clientes"
          subtitulo={comValores ? 'Por faturação no período' : 'Por número de entradas'}
          className="xl:col-span-2"
          onExportar={() => descarregarCsv(ficheiro(r, 'clientes'), ['Cliente', 'Entradas', ...(comValores ? ['Faturado (Kz)'] : [])], c.top.map((x) => [x.nome, x.processos, ...(comValores ? [x.faturado ?? 0] : [])]))}
        >
          {c.top.length === 0 ? <Vazio titulo="Sem clientes no período" /> : (
            <Table>
              <thead><tr><Th>Cliente</Th><Th direita>Entradas</Th>{comValores && <Th direita>Faturado</Th>}</tr></thead>
              <tbody>
                {c.top.map((x) => (
                  <Tr key={x.clienteId}>
                    <Td><Link to={`/clientes/${x.clienteId}`} className="font-semibold text-mzd-black underline-offset-4 hover:underline">{x.nome}</Link></Td>
                    <Td direita num>{x.processos}</Td>
                    {comValores && <Td direita num>{formatAOA(x.faturado ?? 0)}</Td>}
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Bloco>
        <Bloco titulo="Problemas mais encontrados" subtitulo="Sistemas com problemas nos diagnósticos do período">
          {c.sistemas.length === 0 ? <Vazio titulo="Sem diagnósticos no período" /> : <Barras itens={c.sistemas.slice(0, 8).map((s) => ({ rotulo: s.sistema, valor: s.total }))} />}
        </Bloco>
      </div>
      <Bloco
        titulo="Peças mais vendidas"
        subtitulo="Processos faturados no período"
        onExportar={c.pecasTop.length ? () => descarregarCsv(ficheiro(r, 'pecas'), ['Peça', 'Quantidade', ...(comValores ? ['Valor (Kz)'] : [])], c.pecasTop.map((x) => [x.descricao, x.quantidade, ...(comValores ? [x.valor ?? 0] : [])])) : undefined}
      >
        {c.pecasTop.length === 0 ? <Vazio titulo="Sem peças vendidas no período" /> : (
          <Table>
            <thead><tr><Th>Peça</Th><Th direita>Quantidade</Th>{comValores && <Th direita>Valor sem IVA</Th>}</tr></thead>
            <tbody>
              {c.pecasTop.map((x) => (
                <Tr key={x.descricao}>
                  <Td className="text-mzd-black">{x.descricao}</Td>
                  <Td direita num>{x.quantidade}</Td>
                  {comValores && <Td direita num>{formatAOA(x.valor ?? 0)}</Td>}
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Bloco>
    </div>
  );
}
