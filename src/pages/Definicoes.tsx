import { useState } from 'react';
import { Card, CardHeader } from '../components/ui/Card';
import { pecas, utilizadores } from '../data/mock';
import { PERFIL_LABEL } from '../types';
import { formatAOA } from '../lib/format';
import { useToast } from '../components/ui/Toast';
import Tabs from '../components/ui/Tabs';

export default function Definicoes() {
  const toast = useToast();
  const [valorHora, setValorHora] = useState(8500);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-mzd-black">Definições</h1>
        <p className="text-sm text-mzd-gray">Preços-base, modelos de documentos e utilizadores — acesso restrito a Chefia/Direção</p>
      </div>

      <Tabs
        tabs={[
          {
            id: 'precos',
            label: 'Preços-base',
            content: (
              <Card>
                <CardHeader title="Mão de Obra" subtitle="Valor de referência por hora" />
                <div className="flex items-center gap-3 px-5 py-4">
                  <input
                    type="number"
                    value={valorHora}
                    onChange={(e) => setValorHora(Number(e.target.value))}
                    className="w-40 rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-mzd-red focus:ring-1 focus:ring-mzd-red"
                  />
                  <span className="text-sm text-mzd-gray">Kz / hora</span>
                  <button onClick={() => toast('Preço-base atualizado')} className="ml-auto rounded-lg bg-mzd-red px-4 py-2 text-sm font-semibold text-white hover:bg-mzd-redDark">
                    Guardar
                  </button>
                </div>
                <div className="border-t border-zinc-100 px-5 py-4">
                  <p className="mb-2 text-xs font-bold uppercase text-mzd-gray">Catálogo de peças (preço-base)</p>
                  <table className="w-full text-sm">
                    <tbody>
                      {pecas.map((p) => (
                        <tr key={p.id} className="border-b border-zinc-50 last:border-0">
                          <td className="py-2 text-mzd-black">{p.nome}</td>
                          <td className="py-2 text-right text-mzd-gray">{formatAOA(p.precoBase)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ),
          },
          {
            id: 'utilizadores',
            label: 'Utilizadores & Permissões',
            content: (
              <Card>
                <CardHeader title="Utilizadores" />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 text-left text-xs font-semibold uppercase text-mzd-gray">
                        <th className="px-5 py-2.5">Nome</th>
                        <th className="px-5 py-2.5">Perfil</th>
                        <th className="px-5 py-2.5">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {utilizadores.map((u) => (
                        <tr key={u.id} className="border-b border-zinc-50 last:border-0">
                          <td className="px-5 py-3 font-medium text-mzd-black">{u.nome}</td>
                          <td className="px-5 py-3 text-mzd-gray">{PERFIL_LABEL[u.perfil]}</td>
                          <td className="px-5 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${u.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-mzd-gray'}`}>
                              {u.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ),
          },
          {
            id: 'modelos',
            label: 'Modelos de Documentos',
            content: (
              <Card>
                <CardHeader title="Modelos" subtitle="Templates dos 7 documentos oficiais do processo" />
                <ul className="divide-y divide-zinc-50">
                  {['Ficha de Receção', 'Documento de Diagnóstico', 'Orçamento / Fatura Pró-forma', 'Declaração de Autorização', 'Checklist de Qualidade', 'Relatório de Serviços', 'Fatura + Termo de Garantia'].map((d) => (
                    <li key={d} className="flex items-center justify-between px-5 py-3">
                      <span className="text-sm font-medium text-mzd-black">{d}</span>
                      <button onClick={() => toast('Pré-visualização de modelo aberta')} className="text-xs font-semibold text-mzd-red hover:underline">Editar modelo</button>
                    </li>
                  ))}
                </ul>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
