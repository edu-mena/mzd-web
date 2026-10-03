import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useProcessos } from '../../api/hooks';
import { Card } from '../../components/ui/Card';
import StatTile from '../../components/ui/StatTile';
import Matricula from '../../components/ui/Matricula';
import Kz from '../../components/ui/Kz';
import { SearchInput, Segmented } from '../../components/ui/Controls';
import { Table, Th, Tr, Td, LinhaVazia } from '../../components/ui/Table';
import { Carregando, ErroCarregamento } from '../../components/ui/Estados';
import { formatAOA, formatDate, diasEntre } from '../../lib/format';
import { saldoEmAberto, valorPago } from '../../lib/calculos';

type Filtro = 'todas' | 'abertas' | 'pagas';

export default function Faturas() {
  const [query, setQuery] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const { data: processos, isPending, error, refetch } = useProcessos();
  if (isPending) return <Carregando />;
  if (error) return <ErroCarregamento erro={error} onRepetir={refetch} />;

  const todas = processos.filter((p) => p.fatura);
  const q = query.toLowerCase();
  const faturas = todas
    .filter((p) =>
      p.fatura!.numero.toLowerCase().includes(q) ||
      p.cliente.nome.toLowerCase().includes(q) ||
      p.viatura.matricula.toLowerCase().includes(q)
    )
    .filter((p) => (filtro === 'abertas' ? saldoEmAberto(p.fatura) > 0 : filtro === 'pagas' ? saldoEmAberto(p.fatura) === 0 : true))
    .sort((a, b) => b.fatura!.data.localeCompare(a.fatura!.data));

  const totalFaturado = todas.reduce((s, p) => s + p.fatura!.valorTotal, 0);
  const totalRecebido = todas.reduce((s, p) => s + valorPago(p.fatura), 0);
  const totalPorReceber = todas.reduce((s, p) => s + saldoEmAberto(p.fatura), 0);
  const abertas = todas.filter((p) => saldoEmAberto(p.fatura) > 0).length;

  return (
    <div className="space-y-5">

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Total faturado" value={formatAOA(totalFaturado)} />
        <StatTile label="Recebido" value={formatAOA(totalRecebido)} hint="Inclui adiantamentos" />
        <StatTile label="Por receber" value={formatAOA(totalPorReceber)} tom={totalPorReceber > 0 ? 'alerta' : 'neutro'} hint={`${abertas} fatura(s) com saldo em aberto`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Fatura, cliente ou matrícula" label="Pesquisar faturas" />
        <Segmented
          label="Filtrar faturas"
          value={filtro}
          onChange={setFiltro}
          opcoes={[{ valor: 'todas', label: 'Todas' }, { valor: 'abertas', label: 'Em aberto' }, { valor: 'pagas', label: 'Pagas' }]}
        />
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Fatura</Th>
              <Th>Cliente</Th>
              <Th>Viatura</Th>
              <Th>Emissão</Th>
              <Th direita>Total</Th>
              <Th direita>Recebido</Th>
              <Th direita>Saldo</Th>
            </tr>
          </thead>
          <tbody>
            {faturas.map((p) => {
              const fat = p.fatura!;
              const saldo = saldoEmAberto(fat);
              const dias = diasEntre(fat.data);
              return (
                <Tr key={p.id}>
                  <Td>
                    <Link to={`/processos/${p.id}`} className="num font-semibold text-mzd-black underline-offset-4 hover:underline">{fat.numero}</Link>
                  </Td>
                  <Td className="text-mzd-black">{p.cliente.nome}</Td>
                  <Td><Matricula valor={p.viatura.matricula} tamanho="sm" /></Td>
                  <Td num className="text-mzd-gray">{formatDate(fat.data)}</Td>
                  <Td direita><Kz valor={fat.valorTotal} className="font-semibold" /></Td>
                  <Td direita><Kz valor={valorPago(fat)} className="text-mzd-gray" /></Td>
                  <Td direita>
                    {saldo === 0 ? (
                      <span className="rotulo !text-sinal-verde">Pago</span>
                    ) : (
                      <span className="flex flex-col items-end">
                        <Kz valor={saldo} className="font-semibold text-sinal-vermelho" />
                        <span className={clsx('text-[11px]', dias > 30 ? 'font-semibold text-sinal-vermelho' : 'text-mzd-gray')}>há {dias} dias</span>
                      </span>
                    )}
                  </Td>
                </Tr>
              );
            })}
            {faturas.length === 0 && <LinhaVazia colunas={7}>Nenhuma fatura corresponde aos filtros.</LinhaVazia>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
