import { useState } from 'react';
import { Search, Plus, AlertTriangle } from 'lucide-react';
import { pecas } from '../data/mock';
import { Card } from '../components/ui/Card';
import { formatAOA } from '../lib/format';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

export default function Pecas() {
  const [query, setQuery] = useState('');
  const [novoOpen, setNovoOpen] = useState(false);
  const toast = useToast();
  const filtradas = pecas.filter((p) => p.nome.toLowerCase().includes(query.toLowerCase()) || p.categoria.toLowerCase().includes(query.toLowerCase()));
  const baixoStock = pecas.filter((p) => p.stock <= p.stockMinimo);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-mzd-black">Peças & Stock</h1>
          <p className="text-sm text-mzd-gray">{pecas.length} referências no catálogo</p>
        </div>
        <button onClick={() => setNovoOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-mzd-red px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-mzd-redDark">
          <Plus size={16} /> Nova Peça
        </button>
      </div>

      {baixoStock.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
          <AlertTriangle size={16} className="shrink-0" />
          {baixoStock.length} referência(s) com stock abaixo do mínimo: {baixoStock.map((p) => p.nome).join(', ')}
        </div>
      )}

      <div className="relative max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mzd-gray" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar por nome ou categoria…"
          className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-mzd-red focus:ring-1 focus:ring-mzd-red"
        />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs font-semibold uppercase text-mzd-gray">
                <th className="px-5 py-2.5">Peça</th>
                <th className="px-5 py-2.5">Categoria</th>
                <th className="px-5 py-2.5">Fornecedor</th>
                <th className="px-5 py-2.5">Preço-base</th>
                <th className="px-5 py-2.5">Stock</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((p) => {
                const baixo = p.stock <= p.stockMinimo;
                return (
                  <tr key={p.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                    <td className="px-5 py-3 font-medium text-mzd-black">{p.nome}</td>
                    <td className="px-5 py-3 text-mzd-gray">{p.categoria}</td>
                    <td className="px-5 py-3 text-mzd-gray">{p.fornecedor}</td>
                    <td className="px-5 py-3 text-mzd-gray">{formatAOA(p.precoBase)}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${baixo ? 'bg-red-50 text-mzd-red' : 'bg-emerald-50 text-emerald-700'}`}>
                        {p.stock} un. {baixo && '· baixo'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={novoOpen}
        onClose={() => setNovoOpen(false)}
        title="Nova Peça"
        footer={
          <>
            <button onClick={() => setNovoOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-mzd-gray hover:bg-zinc-100">Cancelar</button>
            <button onClick={() => { toast('Peça adicionada ao catálogo'); setNovoOpen(false); }} className="rounded-lg bg-mzd-red px-4 py-2 text-sm font-semibold text-white hover:bg-mzd-redDark">Adicionar</button>
          </>
        }
      >
        <div className="space-y-3">
          <input placeholder="Nome da peça" className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-mzd-red focus:ring-1 focus:ring-mzd-red" />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Categoria" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-mzd-red focus:ring-1 focus:ring-mzd-red" />
            <input placeholder="Fornecedor" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-mzd-red focus:ring-1 focus:ring-mzd-red" />
            <input placeholder="Preço-base (Kz)" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-mzd-red focus:ring-1 focus:ring-mzd-red" />
            <input placeholder="Stock inicial" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-mzd-red focus:ring-1 focus:ring-mzd-red" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
