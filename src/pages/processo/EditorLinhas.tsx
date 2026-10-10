import { useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { usePecas } from '../../api/hooks';
import type { ItemOrcamentoMaoObra, ItemOrcamentoPeca } from '../../types';
import { calcularTotais } from '../../lib/calculos';
import Kz from '../../components/ui/Kz';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Form';

/**
 * Editor das linhas de um orçamento (peças do catálogo ou avulsas + mão de obra),
 * com totais e IVA calculados ao vivo pela mesma regra usada nas faturas.
 */
export default function EditorLinhas({
  pecas,
  maoObra,
  onChange,
  taxaIva,
  isento = false,
  valorHora,
  descontoPct = 0,
}: {
  pecas: ItemOrcamentoPeca[];
  maoObra: ItemOrcamentoMaoObra[];
  onChange: (l: { pecas: ItemOrcamentoPeca[]; maoObra: ItemOrcamentoMaoObra[] }) => void;
  taxaIva: number;
  /** Orçamento sem IVA (mostra "isento" em vez da taxa). */
  isento?: boolean;
  valorHora: number;
  /** Desconto (%) em pré-visualização — aplicado antes do IVA. */
  descontoPct?: number;
}) {
  const { data: catalogo = [] } = usePecas();
  const [q, setQ] = useState('');
  const sugestoes = q.trim().length < 2 ? [] : catalogo.filter((p) => p.nome.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  // Pré-visualização: o desconto entra como se estivesse aprovado (o servidor decide se precisa de aprovação).
  const totais = calcularTotais({
    pecas, maoObra, taxaIva,
    desconto: descontoPct > 0 ? { percentagem: descontoPct, estado: 'aprovado', motivo: '', pedidoPorId: '', pedidoEm: '' } : undefined,
  });

  const setPeca = (i: number, p: Partial<ItemOrcamentoPeca>) => onChange({ pecas: pecas.map((x, k) => (k === i ? { ...x, ...p } : x)), maoObra });
  const setMao = (i: number, m: Partial<ItemOrcamentoMaoObra>) => onChange({ pecas, maoObra: maoObra.map((x, k) => (k === i ? { ...x, ...m } : x)) });

  return (
    <div className="space-y-6">
      <section>
        <h3 className="rotulo mb-2">Peças</h3>
        <div className="space-y-2">
          {pecas.map((p, i) => {
            // Disponível = stock físico menos o que já está reservado para outros processos aprovados.
            const stock = catalogo.find((c) => c.id === p.pecaId)?.disponivel;
            return (
              <div key={i} className="grid grid-cols-[1fr_64px_110px_32px] items-start gap-2">
                <div>
                  <Input value={p.descricao} onChange={(e) => setPeca(i, { descricao: e.target.value })} aria-label={`Peça ${i + 1}`} />
                  {stock !== undefined && (
                    <p className={`mt-0.5 text-[11px] ${stock < p.quantidade ? 'font-semibold text-sinal-ambar' : 'text-mzd-gray'}`}>
                      {stock < p.quantidade ? `Só há ${Math.max(stock, 0)} disponíveis — será preciso encomendar` : `${stock} disponíveis`}
                    </p>
                  )}
                </div>
                <Input value={String(p.quantidade)} onChange={(e) => setPeca(i, { quantidade: Number(e.target.value.replace(/\D/g, '')) || 0 })} inputMode="numeric" className="num text-right" aria-label="Quantidade" />
                <Input value={String(p.precoUnitario)} onChange={(e) => setPeca(i, { precoUnitario: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 })} inputMode="decimal" className="num text-right" aria-label="Preço unitário" />
                <button type="button" onClick={() => onChange({ pecas: pecas.filter((_, k) => k !== i), maoObra })} className="flex h-10 items-center justify-center rounded text-mzd-gray hover:bg-zinc-100 hover:text-mzd-black" aria-label="Remover peça">
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
          {pecas.length > 0 && (
            <p className="grid grid-cols-[1fr_64px_110px_32px] gap-2 text-[10.5px] text-mzd-gray"><span /><span className="text-right">Qtd.</span><span className="text-right">Preço unit. (Kz)</span><span /></p>
          )}
        </div>
        <div className="relative mt-2">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mzd-gray" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar no catálogo de peças…" className="pl-9" aria-label="Procurar peça no catálogo" />
          {sugestoes.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-linha bg-white shadow-flutuante">
              {sugestoes.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ pecas: [...pecas, { pecaId: s.id, descricao: s.nome, quantidade: 1, precoUnitario: s.precoBase }], maoObra });
                      setQ('');
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-zinc-50"
                  >
                    <span className="font-medium text-mzd-black">{s.nome}</span>
                    <span className="flex items-center gap-3 text-xs text-mzd-gray">
                      <span className={s.disponivel <= s.stockMinimo ? 'text-sinal-ambar' : ''}>{s.disponivel} disp.</span>
                      <Kz valor={s.precoBase} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button variante="fantasma" tamanho="sm" icone={<Plus size={14} />} className="mt-1" onClick={() => onChange({ pecas: [...pecas, { descricao: '', quantidade: 1, precoUnitario: 0 }], maoObra })}>
          Peça fora do catálogo
        </Button>
      </section>

      <section>
        <h3 className="rotulo mb-2">Mão de obra</h3>
        <div className="space-y-2">
          {maoObra.map((m, i) => (
            <div key={i} className="grid grid-cols-[1fr_64px_110px_32px] items-start gap-2">
              <Input value={m.descricao} onChange={(e) => setMao(i, { descricao: e.target.value })} aria-label={`Serviço ${i + 1}`} placeholder="Ex.: Substituição de pastilhas" />
              <Input value={String(m.horas)} onChange={(e) => setMao(i, { horas: Number(e.target.value.replace(',', '.').replace(/[^\d.]/g, '')) || 0 })} inputMode="decimal" className="num text-right" aria-label="Horas" />
              <Input value={String(m.valorHora)} onChange={(e) => setMao(i, { valorHora: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 })} inputMode="decimal" className="num text-right" aria-label="Valor por hora" />
              <button type="button" onClick={() => onChange({ pecas, maoObra: maoObra.filter((_, k) => k !== i) })} className="flex h-10 items-center justify-center rounded text-mzd-gray hover:bg-zinc-100 hover:text-mzd-black" aria-label="Remover serviço">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {maoObra.length > 0 && (
            <p className="grid grid-cols-[1fr_64px_110px_32px] gap-2 text-[10.5px] text-mzd-gray"><span /><span className="text-right">Horas</span><span className="text-right">Kz / hora</span><span /></p>
          )}
        </div>
        <Button variante="fantasma" tamanho="sm" icone={<Plus size={14} />} className="mt-1" onClick={() => onChange({ pecas, maoObra: [...maoObra, { descricao: '', horas: 1, valorHora }] })}>
          Adicionar serviço
        </Button>
      </section>

      <dl className="ml-auto w-full max-w-xs space-y-1 border-t border-linha pt-3 text-[13px]">
        <div className="flex justify-between"><dt className="text-mzd-gray">Peças</dt><dd><Kz valor={totais.pecas} /></dd></div>
        <div className="flex justify-between"><dt className="text-mzd-gray">Mão de obra</dt><dd><Kz valor={totais.maoObra} /></dd></div>
        {totais.desconto > 0 && <div className="flex justify-between text-sinal-vermelho"><dt>Desconto ({descontoPct}%)</dt><dd>−<Kz valor={totais.desconto} /></dd></div>}
        <div className="flex justify-between"><dt className="text-mzd-gray">{isento ? 'IVA (isento)' : `IVA (${taxaIva}%)`}</dt><dd><Kz valor={totais.iva} /></dd></div>
        <div className="flex justify-between border-t border-mzd-black pt-1.5 text-base font-bold"><dt>Total</dt><dd><Kz valor={totais.total} /></dd></div>
      </dl>
    </div>
  );
}
