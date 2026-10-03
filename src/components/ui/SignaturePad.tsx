import { useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';

/**
 * Assinatura com o dedo ou caneta (tablet/telemóvel) ou com o rato.
 * Devolve um PNG com fundo transparente sempre que o traço termina; `null` quando é limpa.
 */
export default function SignaturePad({
  onChange,
  legenda,
  altura = 180,
}: {
  onChange: (assinatura: Blob | null) => void;
  legenda: string;
  altura?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const [vazia, setVazia] = useState(true);

  // Ajusta a resolução ao ecrã (nítido em ecrãs de alta densidade).
  useEffect(() => {
    const c = canvas.current!;
    const ajustar = () => {
      const r = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      c.width = r.width * dpr;
      c.height = r.height * dpr;
      const ctx = c.getContext('2d')!;
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#141414';
    };
    ajustar();
  }, []);

  function ponto(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function inicio(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    desenhando.current = true;
    const ctx = canvas.current!.getContext('2d')!;
    const { x, y } = ponto(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    const ctx = canvas.current!.getContext('2d')!;
    const { x, y } = ponto(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function fim() {
    if (!desenhando.current) return;
    desenhando.current = false;
    setVazia(false);
    canvas.current!.toBlob((b) => onChange(b), 'image/png');
  }

  function limpar() {
    const c = canvas.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setVazia(true);
    onChange(null);
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-md border border-linha-forte bg-white">
        <canvas
          ref={canvas}
          style={{ height: altura }}
          className="block w-full cursor-crosshair touch-none"
          onPointerDown={inicio}
          onPointerMove={mover}
          onPointerUp={fim}
          onPointerCancel={fim}
          aria-label={legenda}
          role="img"
        />
        <div className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-dashed border-zinc-300" />
        {vazia && <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-zinc-400">Assine aqui com o dedo, caneta ou rato</p>}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="text-xs text-mzd-gray">{legenda}</p>
        <button type="button" onClick={limpar} disabled={vazia} className="flex items-center gap-1 text-xs font-semibold text-mzd-gray hover:text-mzd-black disabled:opacity-40">
          <Eraser size={13} /> Limpar
        </button>
      </div>
    </div>
  );
}
