import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { List, LayoutGrid, Plus, Search, AlertTriangle } from 'lucide-react';
import { processos, getCliente, getViatura, getUtilizador } from '../data/mock';
import type { EstadoProcesso } from '../types';
import { ESTADOS_ORDEM, ESTADO_LABEL } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import { Card } from '../components/ui/Card';
import { diasEntre, formatDate, orcamentoTotal, formatAOA } from '../lib/format';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

export default function Processos() {
  const [view, setView] = useState<'lista' | 'kanban'>('kanban');
  const [query, setQuery] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoProcesso | 'todos'>('todos');
  const [novoOpen, setNovoOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toast = useToast();

  const filtrados = useMemo(() => {
    return processos.filter((p) => {
      const v = getViatura(p.viaturaId);
      const c = getCliente(p.clienteId);
      const matchQuery =
        query.length === 0 ||
        p.numero.toLowerCase().includes(query.toLowerCase()) ||
        v.matricula.toLowerCase().includes(query.toLowerCase()) ||
        c.nome.toLowerCase().includes(query.toLowerCase());
      const matchEstado = filtroEstado === 'todos' || p.estado === filtroEstado;
      return matchQuery && matchEstado;
    });
  }, [query, filtroEstado]);

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-mzd-black">Processos / Ordens de Serviço</h1>
          <p className="text-sm text-mzd-gray">{filtrados.length} processo(s) encontrado(s)</p>
        </div>
        <button
          onClick={() => setNovoOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-mzd-red px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-mzd-redDark"
        >
          <Plus size={16} /> Novo Processo
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mzd-gray" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar matrícula, cliente, nº OS…"
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-mzd-red focus:ring-1 focus:ring-mzd-red"
          />
        </div>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as any)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-mzd-red"
        >
          <option value="todos">Todos os estados</option>
          {ESTADOS_ORDEM.map((e) => (
            <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
          ))}
        </select>

        <div className="ml-auto flex rounded-lg bg-white p-1 shadow-card ring-1 ring-zinc-200/70">
          <button onClick={() => setView('kanban')} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${view === 'kanban' ? 'bg-mzd-black text-white' : 'text-mzd-gray'}`}>
            <LayoutGrid size={14} /> Funil
          </button>
          <button onClick={() => setView('lista')} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${view === 'lista' ? 'bg-mzd-black text-white' : 'text-mzd-gray'}`}>
            <List size={14} /> Lista
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-mzd-black px-4 py-2.5 text-sm text-white">
          <span className="font-semibold">{selected.size} selecionado(s)</span>
          <button
            onClick={() => { toast(`${selected.size} processo(s) marcados como notificados`); setSelected(new Set()); }}
            className="ml-auto rounded-md bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25"
          >
            Marcar como notificado
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs font-semibold text-zinc-400 hover:text-white">Limpar</button>
        </div>
      )}

      {view === 'kanban' ? <Kanban processos={filtrados} /> : <ListaTabela processos={filtrados} selected={selected} toggleSelect={toggleSelect} />}

      <Modal open={novoOpen} onClose={() => setNovoOpen(false)} title="Novo Processo — Ficha de Receção" wide
        footer={
          <>
            <button onClick={() => setNovoOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-mzd-gray hover:bg-zinc-100">Cancelar</button>
            <button
              onClick={() => { toast('Processo aberto com sucesso — OS-2026-1024'); setNovoOpen(false); }}
              className="rounded-lg bg-mzd-red px-4 py-2 text-sm font-semibold text-white hover:bg-mzd-redDark"
            >
              Abrir Processo
            </button>
          </>
        }
      >
        <NovoProcessoForm />
      </Modal>
    </div>
  );
}

function Kanban({ processos: lista }: { processos: typeof processos }) {
  const colunas = ESTADOS_ORDEM.filter((e) => e !== 'entregue');
  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {colunas.map((estado) => {
        const itens = lista.filter((p) => p.estado === estado);
        return (
          <div key={estado} className="w-72 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wide text-mzd-black">{ESTADO_LABEL[estado]}</h3>
              <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-bold text-mzd-black">{itens.length}</span>
            </div>
            <div className="space-y-2">
              {itens.map((p) => {
                const v = getViatura(p.viaturaId);
                const c = getCliente(p.clienteId);
                const atrasado = diasEntre(p.prazoEntrega) > 0;
                return (
                  <Link to={`/processos/${p.id}`} key={p.id}>
                    <Card className="cursor-pointer p-3.5 transition hover:-translate-y-0.5 hover:shadow-lg">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-mzd-black">{v.matricula}</p>
                        {p.urgente && <AlertTriangle size={14} className="shrink-0 text-mzd-red" />}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-mzd-gray">{v.marca} {v.modelo} · {c.nome}</p>
                      <div className="mt-2.5 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-mzd-gray">{p.numero}</span>
                        <span className={`text-[11px] font-bold ${atrasado ? 'text-mzd-red' : 'text-mzd-gray'}`}>
                          {formatDate(p.prazoEntrega)}
                        </span>
                      </div>
                      {p.aguardaPecas && (
                        <span className="mt-2 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">Aguarda peças</span>
                      )}
                    </Card>
                  </Link>
                );
              })}
              {itens.length === 0 && <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-6 text-center text-xs text-mzd-gray">Sem processos</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListaTabela({ processos: lista, selected, toggleSelect }: { processos: typeof processos; selected: Set<string>; toggleSelect: (id: string) => void }) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-xs font-semibold uppercase text-mzd-gray">
              <th className="w-10 px-4 py-2.5"></th>
              <th className="px-3 py-2.5">Nº OS</th>
              <th className="px-3 py-2.5">Cliente</th>
              <th className="px-3 py-2.5">Viatura</th>
              <th className="px-3 py-2.5">Mecânico</th>
              <th className="px-3 py-2.5">Estado</th>
              <th className="px-3 py-2.5">Valor Orç.</th>
              <th className="px-3 py-2.5">Prazo</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => {
              const v = getViatura(p.viaturaId);
              const c = getCliente(p.clienteId);
              const mec = getUtilizador(p.mecanicoId);
              const atrasado = diasEntre(p.prazoEntrega) > 0 && p.estado !== 'entregue';
              return (
                <tr key={p.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="accent-mzd-red" />
                  </td>
                  <td className="px-3 py-3">
                    <Link to={`/processos/${p.id}`} className="font-semibold text-mzd-black hover:text-mzd-red">{p.numero}</Link>
                    {p.urgente && <AlertTriangle size={12} className="ml-1.5 inline text-mzd-red" />}
                  </td>
                  <td className="px-3 py-3 text-mzd-black">{c.nome}</td>
                  <td className="px-3 py-3 text-mzd-gray">{v.matricula} · {v.marca} {v.modelo}</td>
                  <td className="px-3 py-3 text-mzd-gray">{mec?.nome ?? '—'}</td>
                  <td className="px-3 py-3"><StatusBadge estado={p.estado} /></td>
                  <td className="px-3 py-3 text-mzd-gray">{p.orcamento ? formatAOA(orcamentoTotal(p.orcamento)) : '—'}</td>
                  <td className={`px-3 py-3 font-semibold ${atrasado ? 'text-mzd-red' : 'text-mzd-gray'}`}>{formatDate(p.prazoEntrega)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function NovoProcessoForm() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Nome do cliente" placeholder="Ex: António Ferreira" />
      <Field label="Telefone" placeholder="+244 9xx xxx xxx" />
      <Field label="Matrícula" placeholder="LD-00-00-AA" />
      <Field label="Marca / Modelo" placeholder="Toyota Hilux" />
      <Field label="Ano" placeholder="2020" />
      <Field label="Quilometragem" placeholder="85 000 km" />
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-semibold text-mzd-gray">Queixa relatada pelo cliente</label>
        <textarea rows={3} placeholder="Descreva o problema relatado…" className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-mzd-red focus:ring-1 focus:ring-mzd-red" />
      </div>
      <div className="sm:col-span-2 rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs text-mzd-gray">
        Mapa de danos (topo/perfil) — clique na viatura para marcar riscos/mossas
      </div>
    </div>
  );
}

function Field({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-mzd-gray">{label}</label>
      <input placeholder={placeholder} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-mzd-red focus:ring-1 focus:ring-mzd-red" />
    </div>
  );
}
