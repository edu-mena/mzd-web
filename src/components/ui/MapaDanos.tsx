import { useState } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import type { ItemDano } from '../../types';

const TIPOS: { valor: ItemDano['tipo']; label: string; letra: string }[] = [
  { valor: 'risco', label: 'Risco', letra: 'R' },
  { valor: 'mossa', label: 'Mossa', letra: 'M' },
  { valor: 'outro', label: 'Outro', letra: 'O' },
];
const LETRA = { risco: 'R', mossa: 'M', outro: 'O' } as const;

/** Silhuetas simples da viatura (viewBox 200×100). */
function Silhueta({ vista }: { vista: ItemDano['vista'] }) {
  const traco = { fill: 'none', stroke: '#9c9990', strokeWidth: 1.2, strokeLinejoin: 'round' as const };
  if (vista === 'topo') {
    return (
      <g {...traco}>
        <rect x="14" y="20" width="172" height="60" rx="22" />
        <path d="M120 24 L140 30 L140 70 L120 76 Z" />
        <path d="M58 26 L46 32 L46 68 L58 74 Z" />
        <line x1="70" y1="24" x2="70" y2="76" />
        <line x1="110" y1="24" x2="110" y2="76" />
        <rect x="38" y="13" width="26" height="7" rx="2" />
        <rect x="134" y="13" width="26" height="7" rx="2" />
        <rect x="38" y="80" width="26" height="7" rx="2" />
        <rect x="134" y="80" width="26" height="7" rx="2" />
        <path d="M124 20 l4 -5 h5" />
        <path d="M124 80 l4 5 h5" />
      </g>
    );
  }
  return (
    <g {...traco}>
      <path d="M8 70 V58 Q10 50 28 48 L62 45 Q78 28 98 26 H134 Q150 28 164 45 L184 49 Q193 51 193 60 V70 Z" />
      <path d="M68 45 Q81 31 97 30 H112 V45 Z" />
      <path d="M117 30 H133 Q146 32 156 45 H117 Z" />
      <circle cx="48" cy="71" r="12" />
      <circle cx="156" cy="71" r="12" />
      <line x1="8" y1="62" x2="193" y2="62" strokeDasharray="2 3" />
    </g>
  );
}

/**
 * Mapa de danos visíveis na receção: toque na viatura para marcar riscos, mossas ou outros danos.
 * Em modo só de leitura (documentos) mostra apenas as marcas.
 */
export default function MapaDanos({
  danos,
  onChange,
  soLeitura,
}: {
  danos: ItemDano[];
  onChange?: (danos: ItemDano[]) => void;
  soLeitura?: boolean;
}) {
  const [tipo, setTipo] = useState<ItemDano['tipo']>('risco');

  function marcar(e: React.MouseEvent<SVGSVGElement>, vista: ItemDano['vista']) {
    if (soLeitura || !onChange) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10;
    const y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
    onChange([...danos, { x, y, tipo, vista }]);
  }

  return (
    <div>
      {!soLeitura && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-mzd-black">Marcar:</span>
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => setTipo(t.valor)}
              aria-pressed={tipo === t.valor}
              className={clsx(
                'flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold',
                tipo === t.valor ? 'border-mzd-black bg-mzd-black text-white' : 'border-linha-forte bg-white text-mzd-gray hover:text-mzd-black'
              )}
            >
              <span className="num">{t.letra}</span> {t.label}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(['topo', 'perfil'] as const).map((vista) => (
          <figure key={vista} className="rounded-md border border-linha bg-white p-2">
            <figcaption className="rotulo mb-1 text-center">{vista === 'topo' ? 'Vista de cima' : 'Vista lateral'}</figcaption>
            <svg
              viewBox="0 0 200 100"
              className={clsx('block w-full', !soLeitura && 'cursor-crosshair')}
              onClick={(e) => marcar(e, vista)}
              role={soLeitura ? 'img' : 'button'}
              aria-label={soLeitura ? `Danos — ${vista === 'topo' ? 'vista de cima' : 'vista lateral'}` : `Marcar dano na ${vista === 'topo' ? 'vista de cima' : 'vista lateral'}`}
            >
              <Silhueta vista={vista} />
              {danos.map((d, i) => d.vista === vista && (
                <g key={i} transform={`translate(${d.x * 2} ${d.y})`}>
                  <circle r="5.5" fill="#e60000" stroke="#fff" strokeWidth="1.2" />
                  <text textAnchor="middle" dy="2.2" fontSize="6" fontWeight="700" fill="#fff" fontFamily="IBM Plex Mono">{i + 1}</text>
                </g>
              ))}
            </svg>
          </figure>
        ))}
      </div>
      {danos.length > 0 && (
        <ol className="mt-3 flex flex-wrap gap-1.5">
          {danos.map((d, i) => (
            <li key={i} className="flex items-center gap-1.5 rounded border border-linha bg-white py-1 pl-2 pr-1 text-xs">
              <span className="num font-semibold text-sinal-vermelho">{i + 1}</span>
              <span className="text-mzd-black">{TIPOS.find((t) => t.valor === d.tipo)?.label} · {d.vista === 'topo' ? 'cima' : 'lado'}</span>
              {!soLeitura && onChange && (
                <button type="button" onClick={() => onChange(danos.filter((_, k) => k !== i))} className="rounded p-0.5 text-mzd-gray hover:text-mzd-black" aria-label={`Remover dano ${i + 1}`}>
                  <X size={12} />
                </button>
              )}
              {soLeitura && <span className="num text-mzd-gray">{LETRA[d.tipo]}</span>}
            </li>
          ))}
        </ol>
      )}
      {danos.length === 0 && soLeitura && <p className="mt-2 text-xs text-mzd-gray">Sem danos visíveis assinalados.</p>}
    </div>
  );
}
