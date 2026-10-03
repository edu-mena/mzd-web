import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { useClientes, useDuplicados } from '../api/hooks';
import type { ParDuplicado } from '../api/endpoints';
import { useAuth } from '../auth/useAuth';
import { Card } from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import { Aviso, SearchInput } from '../components/ui/Controls';
import { Table, Th, Tr, Td, LinhaVazia } from '../components/ui/Table';
import { Carregando, ErroCarregamento } from '../components/ui/Estados';
import { formatDate, iniciais } from '../lib/format';
import FormCliente from './cadastros/FormCliente';
import { JuntarClientes } from './cadastros/Dialogos';

export default function Clientes() {
  const [query, setQuery] = useState('');
  const [novo, setNovo] = useState(false);
  const [rever, setRever] = useState<ParDuplicado | null>(null);
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data: clientes, isPending, error, refetch } = useClientes();
  const { data: duplicados = [] } = useDuplicados({ enabled: can('clientes.fundir') });
  if (isPending) return <Carregando />;
  if (error) return <ErroCarregamento erro={error} onRepetir={refetch} />;

  const q = query.toLowerCase();
  const digitos = q.replace(/\D/g, '');
  const filtrados = clientes
    .filter((c) => c.nome.toLowerCase().includes(q) || (digitos.length > 2 && c.telefone.replace(/\D/g, '').includes(digitos)) || (c.nif ?? '').toLowerCase().includes(q))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));

  return (
    <div className="pagina space-y-5">
      <PageHeader
        titulo="Clientes"
        descricao={`${clientes.length} clientes registados`}
        acoes={can('clientes.editar') && <Button icone={<Plus size={16} />} onClick={() => setNovo(true)}>Novo cliente</Button>}
      />

      {duplicados.length > 0 && (
        <Aviso icone={<Users size={16} />}>
          <p className="font-semibold">{duplicados.length} possível(eis) cliente(s) duplicado(s)</p>
          <ul className="mt-1.5 space-y-1">
            {duplicados.map((d) => (
              <li key={d.clientes.map((c) => c.id).join('-')} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-mzd-black">{d.clientes[0].nome} <span className="text-mzd-gray">e</span> {d.clientes[1].nome}</span>
                <span className="rotulo !text-sinal-ambar">{d.motivo}</span>
                <button type="button" onClick={() => setRever(d)} className="text-xs font-semibold text-mzd-black underline underline-offset-4">Rever</button>
              </li>
            ))}
          </ul>
        </Aviso>
      )}

      <SearchInput value={query} onChange={setQuery} placeholder="Nome, telefone ou NIF" label="Pesquisar clientes" />

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Contacto</Th>
              <Th>NIF</Th>
              <Th direita>Viaturas</Th>
              <Th direita>Processos</Th>
              <Th>Cliente desde</Th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <Tr key={c.id}>
                <Td>
                  <Link to={`/clientes/${c.id}`} className="group flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 font-display text-[11px] font-bold text-mzd-black">
                      {iniciais(c.nome)}
                    </span>
                    <span className="font-semibold text-mzd-black group-hover:underline">{c.nome}</span>
                  </Link>
                </Td>
                <Td>
                  <span className="num block text-mzd-black">{c.telefone}</span>
                  {c.email && <span className="block text-xs text-mzd-gray">{c.email}</span>}
                </Td>
                <Td num className="text-mzd-gray">{c.nif ?? '—'}</Td>
                <Td direita num>{c.nViaturas}</Td>
                <Td direita num>{c.nProcessos}</Td>
                <Td num className="text-mzd-gray">{formatDate(c.desde)}</Td>
              </Tr>
            ))}
            {filtrados.length === 0 && <LinhaVazia colunas={6}>Nenhum cliente encontrado para "{query}".</LinhaVazia>}
          </tbody>
        </Table>
      </Card>

      {novo && <FormCliente onFechar={() => setNovo(false)} onGuardado={(c) => navigate(`/clientes/${c.id}`)} />}
      {rever && <JuntarClientes a={rever.clientes[0]} b={rever.clientes[1]} onFechar={() => setRever(null)} />}
    </div>
  );
}
