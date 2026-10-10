import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { CoordenadaPagamento } from '../../types';

/** Contas para transferência no portal, com o IBAN fácil de copiar no telemóvel. */
export default function Coordenadas({ contas, instrucoes, referencia }: { contas: CoordenadaPagamento[]; instrucoes?: string; referencia: string }) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const copiar = (iban: string) => {
    void navigator.clipboard?.writeText(iban.replace(/\s/g, '')).then(() => {
      setCopiado(iban);
      setTimeout(() => setCopiado(null), 2000);
    });
  };
  return (
    <div className="space-y-2">
      {contas.map((c) => (
        <div key={c.id} className="rounded-md border border-linha bg-papel px-3.5 py-2.5">
          <p className="text-[13px] font-semibold text-mzd-black">{c.banco}</p>
          <p className="text-xs text-mzd-gray">{c.titular}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="num break-all text-[13px] text-mzd-black">{c.iban}</span>
            <button type="button" onClick={() => copiar(c.iban)} className="flex shrink-0 items-center gap-1 rounded border border-linha-forte bg-white px-2 py-1 text-[11.5px] font-semibold text-mzd-black hover:border-mzd-black">
              {copiado === c.iban ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar IBAN</>}
            </button>
          </div>
          {c.conta && <p className="num mt-0.5 text-xs text-mzd-gray">Conta {c.conta}</p>}
        </div>
      ))}
      <p className="text-xs text-mzd-gray">
        Descritivo: <span className="num font-semibold text-mzd-black">{referencia}</span>. {instrucoes}
        {' '}Na oficina também aceitamos TPA, Multicaixa Express e numerário.
      </p>
    </div>
  );
}
