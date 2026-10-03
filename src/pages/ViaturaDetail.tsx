import { useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowRightLeft, Pencil, Plus } from 'lucide-react';
import { useProcessos, useViatura } from '../api/hooks';
import { useAuth } from '../auth/useAuth';
import { Card, CardHeader } from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import Matricula from '../components/ui/Matricula';
import Kz from '../components/ui/Kz';
import { Carregando, ErroCarregamento, Vazio } from '../components/ui/Estados';
import { formatDate } from '../lib/format';
import { calcularTotais } from '../lib/calculos';
import { estaAtivo } from '../types';
import Button from '../components/ui/Button';
import { Aviso } from '../components/ui/Controls';
import FormViatura from './cadastros/FormViatura';
import { TransferirViatura } from './cadastros/Dialogos';

export default function ViaturaDetail() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const { data: viatura, isPending, error, refetch } = useViatura(id);
  const { data: historico = [] } = useProcessos({ viaturaId: id });
  const navigate = useNavigate();
  const [aberto, setAberto] = useState<'editar' | 'transferir' | null>(null);

  if (isPending) return <Carregando />;
  if (error) return <ErroCarregamento erro={error} onRepetir={refetch} />;

  const ordenado = [...historico].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  const emCurso = historico.find((p) => estaAtivo(p.estado));

  return (
    <div className="pagina space-y-5">
      <PageHeader
        voltar={{ to: '/viaturas', label: 'Viaturas' }}
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            <Matricula valor={viatura.matricula} tamanho="lg" />
            <span>{viatura.marca} {viatura.modelo}</span>
          </span>
        }
        acoes={
          <>
            {can('clientes.editar') && <Button variante="secundario" icone={<ArrowRightLeft size={15} />} onClick={() => setAberto('transferir')}>Mudar proprietário</Button>}
            {can('clientes.editar') && <Button variante="secundario" icone={<Pencil size={15} />} onClick={() => setAberto('editar')}>Editar</Button>}
            {can('processos.criar') && !emCurso && (
              <Button variante="perigo" icone={<Plus size={15} />} onClick={() => navigate(`/processos/novo?viatura=${viatura.id}`)}>Nova receção</Button>
            )}
          </>
        }
        descricao={
          <>
            Proprietário:{' '}
            {can('clientes.ver') ? (
              <Link to={`/clientes/${viatura.cliente.id}`} className="font-medium text-mzd-black underline-offset-4 hover:underline">{viatura.cliente.nome}</Link>
            ) : (
              <span className="font-medium text-mzd-black">{viatura.cliente.nome}</span>
            )}
          </>
        }
      />

      {emCurso && (
        <Aviso tom="neutro">
          Esta viatura está na oficina: <Link to={`/processos/${emCurso.id}`} className="num font-semibold underline underline-offset-4">{emCurso.numero}</Link>
        </Aviso>
      )}

      <Card>
        <dl className="grid grid-cols-2 divide-linha sm:grid-cols-5 sm:divide-x">
          <Ficha label="Ano"><span className="num">{viatura.ano}</span></Ficha>
          <Ficha label="Cor">{viatura.cor}</Ficha>
          <Ficha label="Quilometragem"><span className="num">{viatura.km.toLocaleString('pt-PT')} km</span></Ficha>
          <Ficha label="Nº de chassi"><span className="num break-all">{viatura.chassi}</span></Ficha>
          <Ficha label="Serviços na MZD"><span className="num">{viatura.nServicos}</span></Ficha>
        </dl>
      </Card>

      <Card>
        <CardHeader title="Histórico de serviços" subtitle="Base para diagnósticos futuros e manutenção preventiva" />
        {ordenado.length === 0 ? (
          <Vazio titulo="Sem serviços registados" />
        ) : (
          <ol className="divide-y divide-linha/70">
            {ordenado.map((p) => (
              <li key={p.id}>
                <Link to={`/processos/${p.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-zinc-50">
                  <span className="num w-24 text-xs text-mzd-gray">{formatDate(p.criadoEm)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-mzd-black">{p.fichaRecepcao.queixaCliente}</span>
                    <span className="num block text-xs text-mzd-gray">{p.numero} · {p.fichaRecepcao.km.toLocaleString('pt-PT')} km</span>
                  </span>
                  {can('valores.ver') && p.orcamento && <Kz valor={calcularTotais(p.orcamento).total} className="text-[13px] text-mzd-gray" />}
                  <StatusBadge estado={p.estado} />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {aberto === 'editar' && <FormViatura viatura={viatura} onFechar={() => setAberto(null)} />}
      {aberto === 'transferir' && <TransferirViatura viatura={viatura} onFechar={() => setAberto(null)} />}
    </div>
  );
}

function Ficha({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-5 py-4">
      <dt className="rotulo">{label}</dt>
      <dd className="mt-1 text-[15px] font-semibold text-mzd-black">{children}</dd>
    </div>
  );
}
