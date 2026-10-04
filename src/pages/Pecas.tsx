import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { useEncomendas, useMovimentos, usePecas, useProcessos, useUtilizadores } from '../api/hooks';
import { useAuth } from '../auth/useAuth';
import type { PecaResumo } from '../types';
import { TIPO_MOVIMENTO_LABEL } from '../types';
import { Card } from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import StatTile from '../components/ui/StatTile';
import Tabs from '../components/ui/Tabs';
import Kz from '../components/ui/Kz';
import { Aviso, SearchInput, Segmented } from '../components/ui/Controls';
import { Table, Th, Tr, Td, LinhaVazia } from '../components/ui/Table';
import { Carregando, ErroCarregamento } from '../components/ui/Estados';
import { formatAOA, formatDateTime } from '../lib/format';
import { margem } from '../lib/calculos';
import { DetalhePeca, FormPeca } from './stock/FormPeca';
import Encomendas from './stock/Encomendas';
import Fornecedores from './stock/Fornecedores';

export default function Pecas() {
  const { can } = useAuth();
  const gerir = can('pecas.editar');
  return (
    <div className="pagina space-y-5">
      <PageHeader titulo="Peças e stock" descricao="Stock físico, reservas para processos aprovados, encomendas a fornecedores" />
      {gerir ? (
        <Tabs
          tabs={[
            { id: 'pecas', label: 'Peças', content: <TabPecas /> },
            { id: 'encomendas', label: 'Encomendas', content: <Encomendas /> },
            { id: 'movimentos', label: 'Movimentos', content: <TabMovimentos /> },
            { id: 'fornecedores', label: 'Fornecedores', content: <Fornecedores /> },
          ]}
        />
      ) : (
        <TabPecas />
      )}
    </div>
  );
}

type Filtro = 'todas' | 'baixo' | 'falta';

function TabPecas() {
  const { can } = useAuth();
  const gerir = can('pecas.editar');
  const verValores = can('valores.ver');
  const [query, setQuery] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [nova, setNova] = useState(false);
  const [aberta, setAberta] = useState<PecaResumo | null>(null);
  const [aEditar, setAEditar] = useState<PecaResumo | null>(null);
  const { data: pecas, isPending, error, refetch } = usePecas();
  const { data: encomendas = [] } = useEncomendas({ enabled: gerir });
  if (isPending) return <Carregando />;
  if (error) return <ErroCarregamento erro={error} onRepetir={refetch} />;

  const baixo = (p: PecaResumo) => p.disponivel <= p.stockMinimo;
  const emFalta = pecas.filter((p) => p.disponivel < 0);
  const abaixo = pecas.filter(baixo);
  const valorStock = pecas.reduce((s, p) => s + p.stock * p.precoCusto, 0);
  const aCaminho = encomendas.filter((e) => e.estado === 'enviada').length;
  const q = query.toLowerCase();
  const filtradas = pecas
    .filter((p) => p.nome.toLowerCase().includes(q) || p.referencia.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q) || p.fornecedor.toLowerCase().includes(q))
    .filter((p) => (filtro === 'baixo' ? baixo(p) : filtro === 'falta' ? p.disponivel < 0 : true))
    .sort((a, b) => Number(baixo(b)) - Number(baixo(a)) || a.nome.localeCompare(b.nome, 'pt'));
  const atual = aberta ? pecas.find((p) => p.id === aberta.id) ?? aberta : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Referências" value={String(pecas.length)} hint={`${abaixo.length} no mínimo ou abaixo`} tom={abaixo.length ? 'aviso' : 'neutro'} />
        <StatTile label="Em falta para processos" value={String(emFalta.length)} tom={emFalta.length ? 'alerta' : 'neutro'} hint="Reservas maiores que o stock" />
        {gerir && <StatTile label="Valor em stock" value={formatAOA(valorStock)} hint="Ao custo médio, sem IVA" />}
        {gerir && <StatTile label="Encomendas a caminho" value={String(aCaminho)} hint="Enviadas, por receber" />}
      </div>

      {emFalta.length > 0 && (
        <Aviso tom="vermelho" icone={<AlertTriangle size={16} />}>
          <strong>Faltam peças para processos já aprovados:</strong> {emFalta.map((p) => `${p.nome} (faltam ${-p.disponivel})`).join(', ')}.
          {gerir && ' Use "Sugerir encomendas" no separador Encomendas.'}
        </Aviso>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Nome, referência, categoria ou fornecedor" label="Pesquisar peças" />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Filtrar" value={filtro} onChange={setFiltro} opcoes={[{ valor: 'todas', label: 'Todas' }, { valor: 'baixo', label: 'No mínimo' }, { valor: 'falta', label: 'Em falta' }]} />
          {gerir && <Button icone={<Plus size={16} />} onClick={() => setNova(true)}>Nova peça</Button>}
        </div>
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Peça</Th>
              <Th>Fornecedor</Th>
              <Th className="w-56">Disponível</Th>
              <Th direita>Stock</Th>
              <Th direita>Reservado</Th>
              {gerir && <Th direita>A caminho</Th>}
              {gerir && <Th direita>Custo</Th>}
              {verValores && <Th direita>Venda</Th>}
              {gerir && <Th direita>Margem</Th>}
            </tr>
          </thead>
          <tbody>
            {filtradas.map((p) => (
              <Tr key={p.id} className={gerir ? 'cursor-pointer' : ''} onClick={gerir ? () => setAberta(p) : undefined}>
                <Td>
                  <span className="block font-semibold text-mzd-black">{p.nome}</span>
                  <span className="num block text-[11px] text-mzd-gray">{p.referencia}{p.localizacao ? ` · ${p.localizacao}` : ''}</span>
                </Td>
                <Td className="text-mzd-gray">{p.fornecedor}</Td>
                <Td><NivelStock peca={p} /></Td>
                <Td direita num>{p.stock}</Td>
                <Td direita num className={p.reservado ? 'text-mzd-black' : 'text-mzd-gray'}>{p.reservado}</Td>
                {gerir && <Td direita num className={p.encomendado ? 'text-sinal-ambar' : 'text-mzd-gray'}>{p.encomendado}</Td>}
                {gerir && <Td direita><Kz valor={p.precoCusto} className="text-mzd-gray" /></Td>}
                {verValores && <Td direita><Kz valor={p.precoBase} /></Td>}
                {gerir && <Td direita num className={margem(p.precoCusto, p.precoBase) < 20 ? 'font-semibold text-sinal-ambar' : 'text-mzd-gray'}>{margem(p.precoCusto, p.precoBase)}%</Td>}
              </Tr>
            ))}
            {filtradas.length === 0 && <LinhaVazia colunas={9}>Nenhuma peça corresponde aos filtros.</LinhaVazia>}
          </tbody>
        </Table>
      </Card>

      {nova && <FormPeca onFechar={() => setNova(false)} />}
      {atual && !aEditar && <DetalhePeca peca={atual} onFechar={() => setAberta(null)} onEditar={() => setAEditar(atual)} />}
      {aEditar && <FormPeca peca={aEditar} onFechar={() => setAEditar(null)} />}
    </div>
  );
}

/** Barra do disponível face ao mínimo (a marca vertical); vermelho se no mínimo, com "faltam N" se negativo. */
function NivelStock({ peca }: { peca: PecaResumo }) {
  const escala = Math.max(peca.stockMinimo * 3, peca.stock, 1);
  const baixo = peca.disponivel <= peca.stockMinimo;
  return (
    <div className="flex items-center gap-3" title={`Disponível ${peca.disponivel} · mínimo ${peca.stockMinimo}`}>
      <span className={clsx('num w-14 text-right text-[13px] font-semibold', baixo ? 'text-sinal-vermelho' : 'text-mzd-black')}>
        {peca.disponivel < 0 ? `−${-peca.disponivel}` : peca.disponivel}
      </span>
      <span className="relative h-[6px] flex-1 rounded-[1px] bg-zinc-100">
        <span className={clsx('absolute inset-y-0 left-0 rounded-[1px]', baixo ? 'bg-mzd-red' : 'bg-mzd-black')} style={{ width: `${(Math.max(peca.disponivel, 0) / escala) * 100}%` }} />
        <span className="absolute -inset-y-1 w-px bg-zinc-500" style={{ left: `${(peca.stockMinimo / escala) * 100}%` }} aria-hidden />
      </span>
    </div>
  );
}

function TabMovimentos() {
  const { data: movimentos, isPending } = useMovimentos();
  const { data: pecas = [] } = usePecas();
  const { data: utilizadores = [] } = useUtilizadores();
  const { data: processos = [] } = useProcessos();
  if (isPending || !movimentos) return <Carregando />;
  return (
    <Card>
      <Table>
        <thead><tr><Th>Data</Th><Th>Peça</Th><Th>Tipo</Th><Th direita>Qtd.</Th><Th direita>Stock após</Th><Th>Por</Th><Th>Motivo</Th></tr></thead>
        <tbody>
          {movimentos.slice(0, 200).map((m) => {
            const proc = processos.find((p) => p.id === m.processoId);
            return (
              <Tr key={m.id}>
                <Td num className="whitespace-nowrap text-mzd-gray">{formatDateTime(m.data)}</Td>
                <Td className="font-medium text-mzd-black">{pecas.find((p) => p.id === m.pecaId)?.nome ?? m.pecaId}</Td>
                <Td>{TIPO_MOVIMENTO_LABEL[m.tipo]}</Td>
                <Td direita num className={m.quantidade < 0 ? 'text-sinal-vermelho' : 'text-sinal-verde'}>{m.quantidade > 0 ? '+' : ''}{m.quantidade}</Td>
                <Td direita num>{m.stockApos}</Td>
                <Td className="text-mzd-gray">{utilizadores.find((u) => u.id === m.utilizadorId)?.nome ?? '—'}</Td>
                <Td className="text-mzd-gray">
                  {proc ? <Link to={`/processos/${proc.id}`} className="underline underline-offset-4">{m.motivo}</Link> : m.motivo ?? '—'}
                </Td>
              </Tr>
            );
          })}
          {movimentos.length === 0 && <LinhaVazia colunas={7}>Sem movimentos.</LinhaVazia>}
        </tbody>
      </Table>
    </Card>
  );
}
