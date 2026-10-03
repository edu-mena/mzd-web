import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useViaturas } from '../api/hooks';
import { useAuth } from '../auth/useAuth';
import { Card } from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import Matricula from '../components/ui/Matricula';
import { SearchInput } from '../components/ui/Controls';
import { Table, Th, Tr, Td, LinhaVazia } from '../components/ui/Table';
import { Carregando, ErroCarregamento } from '../components/ui/Estados';

export default function Viaturas() {
  const [query, setQuery] = useState('');
  const { can } = useAuth();
  const { data: viaturas, isPending, error, refetch } = useViaturas();
  if (isPending) return <Carregando />;
  if (error) return <ErroCarregamento erro={error} onRepetir={refetch} />;

  const q = query.toLowerCase().replace(/[\s-]/g, '');
  const filtrados = viaturas.filter(
    (v) => v.matricula.toLowerCase().replace(/[\s-]/g, '').includes(q) || `${v.marca}${v.modelo}`.toLowerCase().replace(/\s/g, '').includes(q)
  );

  return (
    <div className="pagina space-y-5">
      <PageHeader titulo="Viaturas" descricao={`${viaturas.length} viaturas no histórico da oficina`} />
      <SearchInput value={query} onChange={setQuery} placeholder="Matrícula, marca ou modelo" label="Pesquisar viaturas" />

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Matrícula</Th>
              <Th>Marca / Modelo</Th>
              <Th direita>Ano</Th>
              <Th>Cor</Th>
              <Th direita>Km</Th>
              <Th>Proprietário</Th>
              <Th direita>Serviços</Th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((v) => (
              <Tr key={v.id}>
                <Td>
                  <Link to={`/viaturas/${v.id}`} aria-label={`Abrir viatura ${v.matricula}`}><Matricula valor={v.matricula} tamanho="sm" /></Link>
                </Td>
                <Td>
                  <Link to={`/viaturas/${v.id}`} className="font-semibold text-mzd-black underline-offset-4 hover:underline">{v.marca} {v.modelo}</Link>
                </Td>
                <Td direita num className="text-mzd-gray">{v.ano}</Td>
                <Td className="text-mzd-gray">{v.cor}</Td>
                <Td direita num className="text-mzd-gray">{v.km.toLocaleString('pt-PT')}</Td>
                <Td>
                  {can('clientes.ver')
                    ? <Link to={`/clientes/${v.cliente.id}`} className="text-mzd-black underline-offset-4 hover:underline">{v.cliente.nome}</Link>
                    : v.cliente.nome}
                </Td>
                <Td direita num>{v.nServicos}</Td>
              </Tr>
            ))}
            {filtrados.length === 0 && <LinhaVazia colunas={7}>Nenhuma viatura encontrada para "{query}".</LinhaVazia>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
