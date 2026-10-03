import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MessageCircle, Pencil, Plus, Users } from 'lucide-react';
import { useCliente, useContaCorrente, useProcessos, useViaturas } from '../api/hooks';
import { Table, Th, Tr, Td } from '../components/ui/Table';
import { useAuth } from '../auth/useAuth';
import { Card, CardHeader } from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import StatTile from '../components/ui/StatTile';
import StatusBadge from '../components/ui/StatusBadge';
import Matricula from '../components/ui/Matricula';
import Kz from '../components/ui/Kz';
import { Carregando, ErroCarregamento, Vazio } from '../components/ui/Estados';
import { formatDate, formatAOA } from '../lib/format';
import { calcularTotais, saldoEmAberto } from '../lib/calculos';
import { estaAtivo } from '../types';
import Button from '../components/ui/Button';
import { botao } from '../components/ui/botao';
import { linkWhatsApp } from '../lib/mensagens';
import FormCliente from './cadastros/FormCliente';
import FormViatura from './cadastros/FormViatura';
import { JuntarClientes } from './cadastros/Dialogos';

export default function ClienteDetail() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const { data: cliente, isPending, error, refetch } = useCliente(id);
  const { data: viaturasCliente = [] } = useViaturas({ clienteId: id });
  const { data: processosCliente = [] } = useProcessos({ clienteId: id });
  const navigate = useNavigate();
  const [aberto, setAberto] = useState<'editar' | 'viatura' | 'juntar' | null>(null);
  const { data: conta = [] } = useContaCorrente(id, { enabled: can('valores.ver') });

  if (isPending) return <Carregando />;
  if (error) return <ErroCarregamento erro={error} onRepetir={refetch} />;

  const verValores = can('valores.ver');
  const processosOrdenados = [...processosCliente].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  const faturado = processosCliente.reduce((s, p) => s + (p.fatura?.valorTotal ?? 0), 0);
  const emAberto = processosCliente.reduce((s, p) => s + saldoEmAberto(p.fatura), 0);
  const ultima = processosOrdenados[0];

  return (
    <div className="pagina space-y-5">
      <PageHeader
        voltar={{ to: '/clientes', label: 'Clientes' }}
        titulo={cliente.nome}
        descricao={
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            <span className="num text-mzd-black">{cliente.telefone}</span>
            {cliente.email && <span>{cliente.email}</span>}
            <span>NIF <span className="num">{cliente.nif ?? '—'}</span></span>
            <span>Cliente desde {formatDate(cliente.desde)}</span>
          </span>
        }
        acoes={
          <>
            {cliente.consentimentoMensagens && (
              <a href={linkWhatsApp(cliente.telefone, `Olá ${cliente.nome.split(' ')[0]}, `)} target="_blank" rel="noopener noreferrer" className={botao('secundario')}>
                <MessageCircle size={15} /> WhatsApp
              </a>
            )}
            {can('clientes.fundir') && <Button variante="secundario" icone={<Users size={15} />} onClick={() => setAberto('juntar')}>Juntar duplicado</Button>}
            {can('clientes.editar') && <Button icone={<Pencil size={15} />} onClick={() => setAberto('editar')}>Editar</Button>}
          </>
        }
        extra={
          <span className={`rotulo rounded px-2 py-[3px] ${cliente.consentimentoMensagens ? 'bg-zinc-100 !text-mzd-black' : 'bg-sinal-ambar-fundo !text-sinal-ambar'}`}>
            {cliente.consentimentoMensagens ? 'Aceita mensagens' : 'Sem consentimento para mensagens'}
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Processos" value={String(processosCliente.length)} hint={`${processosCliente.filter((p) => estaAtivo(p.estado)).length} em curso`} />
        <StatTile label="Última visita" value={ultima ? formatDate(ultima.criadoEm) : '—'} />
        {verValores && <StatTile label="Total faturado" value={formatAOA(faturado)} />}
        {verValores && <StatTile label="Em aberto" value={formatAOA(emAberto)} tom={emAberto > 0 ? 'alerta' : 'neutro'} />}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Viaturas"
            subtitle={`${viaturasCliente.length} registada(s)`}
            action={can('clientes.editar') && <Button variante="fantasma" tamanho="sm" icone={<Plus size={14} />} onClick={() => setAberto('viatura')}>Adicionar</Button>}
          />
          <ul className="divide-y divide-linha/70">
            {viaturasCliente.map((v) => (
              <li key={v.id}>
                <Link to={`/viaturas/${v.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50">
                  <Matricula valor={v.matricula} tamanho="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-mzd-black">{v.marca} {v.modelo}</span>
                    <span className="num block text-xs text-mzd-gray">{v.ano} · {v.km.toLocaleString('pt-PT')} km</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Histórico de processos" />
          {processosOrdenados.length === 0 ? (
            <Vazio titulo="Sem processos">Os processos deste cliente aparecem aqui.</Vazio>
          ) : (
            <ul className="divide-y divide-linha/70">
              {processosOrdenados.map((p) => (
                <li key={p.id}>
                  <Link to={`/processos/${p.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-zinc-50">
                    <span className="num w-24 text-xs text-mzd-gray">{formatDate(p.criadoEm)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-mzd-black">{p.fichaRecepcao.queixaCliente}</span>
                      <span className="num block text-xs text-mzd-gray">{p.numero} · {p.viatura.matricula}</span>
                    </span>
                    {verValores && p.orcamento && <Kz valor={calcularTotais(p.orcamento).total} className="text-[13px] text-mzd-gray" />}
                    <StatusBadge estado={p.estado} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {verValores && conta.length > 0 && (
        <Card>
          <CardHeader
            title="Conta corrente"
            subtitle="Faturas (débito), pagamentos (crédito) e anulações, por ordem cronológica"
            action={<span className="text-sm">Saldo: <Kz valor={conta[conta.length - 1].saldo} className={`font-semibold ${conta[conta.length - 1].saldo > 0 ? 'text-sinal-vermelho' : ''}`} /></span>}
          />
          <Table>
            <thead><tr><Th>Data</Th><Th>Documento</Th><Th>Processo</Th><Th direita>Débito</Th><Th direita>Crédito</Th><Th direita>Saldo</Th></tr></thead>
            <tbody>
              {conta.map((m, i) => (
                <Tr key={i}>
                  <Td num className="text-mzd-gray">{formatDate(m.data)}</Td>
                  <Td className={m.tipo === 'anulacao' ? 'text-sinal-vermelho' : ''}><span className="num">{m.documento}</span></Td>
                  <Td><Link to={`/processos/${m.processoId}`} className="num text-mzd-gray underline-offset-4 hover:underline">{m.processoNumero}</Link></Td>
                  <Td direita>{m.debito ? <Kz valor={m.debito} /> : <span className="text-zinc-300">—</span>}</Td>
                  <Td direita>{m.credito ? <Kz valor={m.credito} className="text-sinal-verde" /> : <span className="text-zinc-300">—</span>}</Td>
                  <Td direita><Kz valor={m.saldo} className="font-semibold" /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {aberto === 'editar' && <FormCliente cliente={cliente} onFechar={() => setAberto(null)} />}
      {aberto === 'viatura' && <FormViatura clienteId={cliente.id} onFechar={() => setAberto(null)} onGuardada={(v) => navigate(`/viaturas/${v.id}`)} />}
      {aberto === 'juntar' && (
        <JuntarClientes
          a={{ ...cliente, nViaturas: viaturasCliente.length, nProcessos: processosCliente.length }}
          onFechar={() => setAberto(null)}
          onJuntado={(c) => c.id !== cliente.id && navigate(`/clientes/${c.id}`, { replace: true })}
        />
      )}
    </div>
  );
}
