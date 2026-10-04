import { useRef, useState } from 'react';
import { Camera, Film, FileText, Loader2, X } from 'lucide-react';
import clsx from 'clsx';
import type { Anexo } from '../../types';
import { useUrlAnexo } from '../../lib/useUrlAnexo';
import { comprimirImagem, tamanhoLegivel } from '../../lib/imagem';
import Modal from './Modal';

export const LIMITE_VIDEO_MB = 60;

/** Ficheiro escolhido mas ainda não enviado (ex.: no assistente de receção, antes de o processo existir). */
export interface FicheiroPendente {
  id: string;
  ficheiro: Blob;
  nome: string;
  tipo: 'foto' | 'video';
  previsualizacao: string;
}

/**
 * Botão para tirar/escolher fotos e vídeos. Em telemóvel abre a câmara traseira.
 * As fotos são comprimidas antes de serem devolvidas.
 */
export function SeletorFicheiros({
  onEscolher,
  aceitarVideo = true,
  rotulo = 'Tirar ou escolher fotos',
  ocupado,
}: {
  onEscolher: (ficheiros: FicheiroPendente[], erros: string[]) => void;
  aceitarVideo?: boolean;
  rotulo?: string;
  ocupado?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [aProcessar, setAProcessar] = useState(false);

  async function escolher(lista: FileList | null) {
    if (!lista?.length) return;
    setAProcessar(true);
    const ok: FicheiroPendente[] = [];
    const erros: string[] = [];
    for (const f of Array.from(lista)) {
      const video = f.type.startsWith('video/');
      if (video && !aceitarVideo) continue;
      if (!video && !f.type.startsWith('image/')) {
        erros.push(`"${f.name}" não é uma imagem nem um vídeo.`);
        continue;
      }
      if (video && f.size > LIMITE_VIDEO_MB * 1024 * 1024) {
        erros.push(`"${f.name}" tem ${tamanhoLegivel(f.size)} — o máximo para vídeos é ${LIMITE_VIDEO_MB} MB.`);
        continue;
      }
      const blob = video ? f : await comprimirImagem(f);
      ok.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ficheiro: blob,
        nome: video ? f.name : f.name.replace(/\.\w+$/, '.jpg'),
        tipo: video ? 'video' : 'foto',
        previsualizacao: URL.createObjectURL(blob),
      });
    }
    setAProcessar(false);
    if (input.current) input.current.value = '';
    onEscolher(ok, erros);
  }

  const aCarregar = aProcessar || ocupado;
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={aceitarVideo ? 'image/*,video/*' : 'image/*'}
        capture="environment"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        aria-label="Escolher fotografias ou vídeos"
        onChange={(e) => escolher(e.target.files)}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={aCarregar}
        className="flex min-h-24 w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-linha-forte bg-white px-4 py-4 text-sm font-semibold text-mzd-black transition-colors hover:border-mzd-black disabled:opacity-60"
      >
        {aCarregar ? <Loader2 size={20} className="animate-spin text-mzd-gray" /> : <Camera size={20} strokeWidth={1.75} />}
        {aCarregar ? 'A preparar…' : rotulo}
        <span className="text-xs font-normal text-mzd-gray">
          {aceitarVideo ? `Fotos são comprimidas automaticamente · vídeos até ${LIMITE_VIDEO_MB} MB` : 'Fotos são comprimidas automaticamente'}
        </span>
      </button>
    </>
  );
}

/** Miniatura de um ficheiro pendente (antes do envio). */
export function MiniaturaPendente({ f, onRemover }: { f: FicheiroPendente; onRemover?: () => void }) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-md border border-linha bg-zinc-100">
      {f.tipo === 'foto' ? (
        <img src={f.previsualizacao} alt={f.nome} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-1 text-mzd-gray">
          <Film size={20} />
          <span className="text-[10px]">{tamanhoLegivel(f.ficheiro.size)}</span>
        </div>
      )}
      {onRemover && (
        <button
          type="button"
          onClick={onRemover}
          className="absolute right-1 top-1 rounded bg-mzd-black/80 p-1 text-white hover:bg-mzd-black"
          aria-label={`Remover ${f.nome}`}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

/** Miniatura de um anexo já guardado no servidor; abre em grande ao clicar. */
export function MiniaturaAnexo({ anexo, onAbrir }: { anexo: Anexo; onAbrir?: () => void }) {
  const url = useUrlAnexo(anexo);
  const imagem = anexo.tipo === 'foto' || anexo.tipo === 'assinatura';
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={clsx(
        'relative block aspect-square w-full overflow-hidden rounded-md border border-linha transition-colors hover:border-zinc-400',
        anexo.tipo === 'assinatura' ? 'bg-white' : 'bg-zinc-100'
      )}
      aria-label={`Abrir ${anexo.legenda ?? anexo.nome}`}
    >
      {imagem && url ? (
        <img src={url} alt={anexo.legenda ?? anexo.nome} className={clsx('h-full w-full', anexo.tipo === 'assinatura' ? 'object-contain p-2' : 'object-cover')} loading="lazy" />
      ) : (
        <span className="flex h-full flex-col items-center justify-center gap-1 text-mzd-gray">
          {anexo.tipo === 'video' ? <Film size={20} /> : anexo.tipo === 'documento' ? <FileText size={20} /> : <Loader2 size={16} className="animate-spin" />}
          <span className="text-[10px]">{tamanhoLegivel(anexo.tamanhoBytes)}</span>
        </span>
      )}
    </button>
  );
}

/** Imagem de um anexo (ex.: assinatura em documentos). */
export function ImagemAnexo({ anexo, className, alt }: { anexo: Pick<Anexo, 'url'>; className?: string; alt: string }) {
  const url = useUrlAnexo(anexo);
  return url ? <img src={url} alt={alt} className={className} /> : <span className={clsx('block animate-pulse bg-zinc-100', className)} />;
}

/** Visualizador em grande de um anexo (foto ou vídeo). */
export function VisualizadorAnexo({ anexo, onFechar }: { anexo: Anexo | null; onFechar: () => void }) {
  const url = useUrlAnexo(anexo ?? undefined);
  return (
    <Modal open={!!anexo} onClose={onFechar} title={anexo?.legenda ?? anexo?.nome ?? ''} wide>
      {anexo && url && (
        anexo.tipo === 'video'
          ? <video src={url} controls className="max-h-[70vh] w-full rounded bg-black" />
          : <img src={url} alt={anexo.legenda ?? anexo.nome} className="mx-auto max-h-[70vh] rounded object-contain" />
      )}
    </Modal>
  );
}
