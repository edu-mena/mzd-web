import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import clsx from 'clsx';
import type { ImagemSite as TImagem } from '../../types';
import { useUrlAnexo } from '../../lib/useUrlAnexo';
import { useDialogo } from '../../components/ui/useDialogo';

/** Imagem do site: caminho público ou ficheiro enviado pelo administrador. */
export function Imagem({ imagem, className, prioridade, sizes }: { imagem: TImagem; className?: string; prioridade?: boolean; sizes?: string }) {
  const url = useUrlAnexo(imagem);
  if (!url) return <span className={clsx('block animate-pulse bg-zinc-200', className)} aria-hidden />;
  return (
    <img
      src={url}
      alt={imagem.alt}
      className={className}
      loading={prioridade ? 'eager' : 'lazy'}
      fetchPriority={prioridade ? 'high' : undefined}
      decoding="async"
      sizes={sizes}
    />
  );
}

/** Título de secção: número em mono, rótulo e título largo. */
export function TituloSeccao({ numero, rotulo, titulo, id, claro, children }: { numero: string; rotulo: string; titulo: ReactNode; id: string; claro?: boolean; children?: ReactNode }) {
  return (
    <div className="revelar max-w-3xl">
      <p className={clsx('num text-xs tracking-[0.2em]', claro ? 'text-zinc-400' : 'text-mzd-gray')}>
        {/* Vermelho de texto com contraste suficiente: mais escuro sobre claro, mais claro sobre preto. */}
        <span className={claro ? 'text-red-400' : 'text-sinal-vermelho'}>{numero}</span> — {rotulo.toUpperCase()}
      </p>
      <h2 id={id} className={clsx('mt-3 font-display text-[clamp(1.9rem,4.2vw,3.1rem)] font-extrabold leading-[1.02] [font-stretch:115%]', claro ? 'text-white' : 'text-mzd-black')}>
        {titulo}
      </h2>
      {children && <p className={clsx('mt-4 text-[15.5px] leading-relaxed', claro ? 'text-zinc-300' : 'text-mzd-graphite')}>{children}</p>}
    </div>
  );
}

/** Galeria em mosaico com visualizador (setas do teclado, Esc, deslizar no telemóvel). */
export function Galeria({ imagens }: { imagens: (TImagem & { id: string })[] }) {
  const [aberta, setAberta] = useState<number | null>(null);
  return (
    <>
      <ul className="columns-1 gap-3 sm:columns-2 lg:columns-3 [&>li]:mb-3">
        {imagens.map((img, i) => (
          <li key={img.id} className="revelar break-inside-avoid">
            <button type="button" onClick={() => setAberta(i)} className="group relative block w-full overflow-hidden rounded-[3px] bg-zinc-200" aria-label={`Ampliar: ${img.alt}`}>
              <Imagem imagem={img} className="w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
              <span className="pointer-events-none absolute inset-0 bg-mzd-black/0 transition-colors group-hover:bg-mzd-black/15" />
            </button>
          </li>
        ))}
      </ul>
      {aberta !== null && <Visualizador imagens={imagens} inicial={aberta} onFechar={() => setAberta(null)} />}
    </>
  );
}

function Visualizador({ imagens, inicial, onFechar }: { imagens: TImagem[]; inicial: number; onFechar: () => void }) {
  const [i, setI] = useState(inicial);
  const caixa = useRef<HTMLDivElement>(null);
  const toque = useRef<number | null>(null);
  useDialogo(true, onFechar, caixa);
  const ir = (d: number) => setI((x) => (x + d + imagens.length) % imagens.length);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') ir(1);
      else if (e.key === 'ArrowLeft') ir(-1);
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });
  const img = imagens[i];
  return createPortal(
    <div
      ref={caixa}
      role="dialog"
      aria-modal="true"
      aria-label={`Fotografia ${i + 1} de ${imagens.length}: ${img.alt}`}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-mzd-black/95 outline-none"
      onTouchStart={(e) => { toque.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (toque.current === null) return;
        const d = e.changedTouches[0].clientX - toque.current;
        if (Math.abs(d) > 50) ir(d < 0 ? 1 : -1);
        toque.current = null;
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="num text-xs text-zinc-400">{String(i + 1).padStart(2, '0')} / {String(imagens.length).padStart(2, '0')}</span>
        <button type="button" onClick={onFechar} className="rounded-full p-2 hover:bg-white/10" aria-label="Fechar"><X size={22} /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4 sm:px-16">
        <Imagem imagem={img} className="max-h-full max-w-full rounded-[3px] object-contain" prioridade />
        <button type="button" onClick={() => ir(-1)} className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:block" aria-label="Anterior"><ChevronLeft size={22} /></button>
        <button type="button" onClick={() => ir(1)} className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:block" aria-label="Seguinte"><ChevronRight size={22} /></button>
      </div>
      <p className="px-4 pb-5 text-center text-sm text-zinc-300">
        {img.alt}
        {img.credito && <span className="block text-[11px] text-zinc-500">Fotografia: {img.credito}</span>}
      </p>
    </div>,
    document.body,
  );
}
