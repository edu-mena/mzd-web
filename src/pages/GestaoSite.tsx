import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { useGuardarSite, useSite } from '../api/hooks';
import { api } from '../api/endpoints';
import type { ConteudoSite, ImagemSite } from '../types';
import PageHeader from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Field, Input, Textarea } from '../components/ui/Form';
import { Aviso } from '../components/ui/Controls';
import { Carregando, ErroCarregamento } from '../components/ui/Estados';
import { botao } from '../components/ui/botao';
import { useToast } from '../components/ui/toast-context';
import { mensagemErro } from '../lib/erros';
import { comprimirImagem } from '../lib/imagem';
import { formatDateTime } from '../lib/format';
import { Imagem } from './site/Partes';

const novoId = () => `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const IMAGEM_VAZIA: ImagemSite = { url: '/site/galeria-oficina.jpg', alt: 'Fotografia da oficina' };

/** Edição do site público pelo administrador do sistema. */
export default function GestaoSite() {
  const { data, isPending, error, refetch } = useSite();
  if (isPending) return <Carregando />;
  if (error || !data) return <ErroCarregamento erro={error} onRepetir={refetch} />;
  return <Editor inicial={data} />;
}

function Editor({ inicial }: { inicial: ConteudoSite }) {
  const toast = useToast();
  const guardar = useGuardarSite();
  const [c, setC] = useState(inicial);
  const alterado = JSON.stringify(c) !== JSON.stringify(inicial);
  const set = <K extends keyof ConteudoSite>(k: K, v: ConteudoSite[K]) => setC({ ...c, [k]: v });

  return (
    <div className="pagina space-y-5 pb-24">
      <PageHeader
        titulo="Site"
        descricao={<>O que os clientes veem em <span className="num">mzd.it.ao</span>{inicial.atualizadoEm && <> · última alteração {formatDateTime(inicial.atualizadoEm)}</>}</>}
        acoes={<a href="/site" target="_blank" rel="noopener noreferrer" className={botao('secundario')}><ExternalLink size={15} /> Ver o site</a>}
      />

      <Card>
        <CardHeader title="Abertura" subtitle="A primeira coisa que se vê: título, frase e fotografia de fundo" />
        <div className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-4">
            <Field label="Título" hint="Curto e direto. O ponto final fica a vermelho.">{(a) => <Input {...a} value={c.hero.titulo} maxLength={80} onChange={(e) => set('hero', { ...c.hero, titulo: e.target.value })} />}</Field>
            <Field label="Frase de apresentação">{(a) => <Textarea {...a} rows={3} value={c.hero.subtitulo} maxLength={300} onChange={(e) => set('hero', { ...c.hero, subtitulo: e.target.value })} />}</Field>
          </div>
          <EditorImagem imagem={c.hero.imagem} onChange={(imagem) => set('hero', { ...c.hero, imagem })} />
        </div>
      </Card>

      <Lista
        titulo="Destaques" subtitulo="Três frases curtas sobre como a oficina trabalha" max={4}
        itens={c.destaques} onChange={(v) => set('destaques', v)}
        novo={() => ({ titulo: 'Novo destaque', texto: 'Descreva em poucas palavras.' })}
        render={(d, mudar) => (
          <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
            <Field label="Título">{(a) => <Input {...a} value={d.titulo} maxLength={50} onChange={(e) => mudar({ ...d, titulo: e.target.value })} />}</Field>
            <Field label="Texto">{(a) => <Input {...a} value={d.texto} maxLength={200} onChange={(e) => mudar({ ...d, texto: e.target.value })} />}</Field>
          </div>
        )}
      />

      <Lista
        titulo="Modelos Mitsubishi" subtitulo="Aparecem na secção interativa; escolher um leva-o para o pedido" max={12}
        itens={c.modelos} onChange={(v) => set('modelos', v)}
        novo={() => ({ id: novoId(), nome: 'Novo modelo', descricao: 'O que fazemos neste modelo.', imagem: IMAGEM_VAZIA })}
        render={(x, mudar) => (
          <div className="grid gap-3 lg:grid-cols-[1fr_16rem]">
            <div className="space-y-3">
              <Field label="Nome">{(a) => <Input {...a} value={x.nome} maxLength={40} onChange={(e) => mudar({ ...x, nome: e.target.value })} />}</Field>
              <Field label="Descrição">{(a) => <Textarea {...a} rows={2} value={x.descricao} maxLength={240} onChange={(e) => mudar({ ...x, descricao: e.target.value })} />}</Field>
            </div>
            <EditorImagem imagem={x.imagem} onChange={(imagem) => mudar({ ...x, imagem })} />
          </div>
        )}
      />

      <Lista
        titulo="Serviços" subtitulo="Cada cartão tem um botão que escolhe o serviço no pedido" max={12}
        itens={c.servicos} onChange={(v) => set('servicos', v)}
        novo={() => ({ id: novoId(), titulo: 'Novo serviço', descricao: 'O que inclui.', imagem: IMAGEM_VAZIA })}
        render={(x, mudar) => (
          <div className="grid gap-3 lg:grid-cols-[1fr_16rem]">
            <div className="space-y-3">
              <Field label="Serviço">{(a) => <Input {...a} value={x.titulo} maxLength={50} onChange={(e) => mudar({ ...x, titulo: e.target.value })} />}</Field>
              <Field label="Descrição">{(a) => <Textarea {...a} rows={2} value={x.descricao} maxLength={240} onChange={(e) => mudar({ ...x, descricao: e.target.value })} />}</Field>
            </div>
            <EditorImagem imagem={x.imagem} onChange={(imagem) => mudar({ ...x, imagem })} />
          </div>
        )}
      />

      <Lista
        titulo="Galeria da oficina" subtitulo="Fotografias da oficina e de trabalhos feitos (de preferência, vossas)" max={24}
        itens={c.galeria} onChange={(v) => set('galeria', v)}
        novo={() => ({ id: novoId(), ...IMAGEM_VAZIA })}
        render={(x, mudar) => <EditorImagem imagem={x} onChange={(img) => mudar({ ...x, ...img })} horizontal />}
      />

      <Lista
        titulo="Testemunhos" subtitulo="Só testemunhos reais, com autorização do cliente. Sem nenhum, a secção não aparece." max={12}
        itens={c.testemunhos} onChange={(v) => set('testemunhos', v)}
        novo={() => ({ id: novoId(), nome: '', viatura: '', texto: '' })}
        render={(t, mudar) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome do cliente">{(a) => <Input {...a} value={t.nome} maxLength={60} onChange={(e) => mudar({ ...t, nome: e.target.value })} />}</Field>
            <Field label="Viatura" hint="Opcional">{(a) => <Input {...a} value={t.viatura ?? ''} maxLength={60} onChange={(e) => mudar({ ...t, viatura: e.target.value })} />}</Field>
            <Field label="Testemunho" className="sm:col-span-2">{(a) => <Textarea {...a} rows={2} value={t.texto} maxLength={400} onChange={(e) => mudar({ ...t, texto: e.target.value })} />}</Field>
          </div>
        )}
      />

      <Card>
        <CardHeader title="Contactos" subtitle="Usados nos botões de telefone, WhatsApp e email do site" />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          {([['telefone', 'Telefone'], ['whatsapp', 'WhatsApp'], ['email', 'Email'], ['morada', 'Morada'], ['horario', 'Horário']] as const).map(([k, l]) => (
            <Field key={k} label={l}>{(a) => <Input {...a} value={c.contactos[k]} onChange={(e) => set('contactos', { ...c.contactos, [k]: e.target.value })} />}</Field>
          ))}
          <Field label="Ligação do Google Maps" hint="Opcional: no Google Maps, Partilhar → Copiar link">{(a) => <Input {...a} value={c.contactos.mapaUrl ?? ''} onChange={(e) => set('contactos', { ...c.contactos, mapaUrl: e.target.value })} placeholder="https://maps.app.goo.gl/…" />}</Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Google e partilhas" subtitle="Título e descrição que aparecem nas pesquisas e quando o link é partilhado" />
        <div className="space-y-4 px-5 py-4">
          <Field label="Título" hint={`${c.seo.titulo.length}/70 caracteres`}>{(a) => <Input {...a} value={c.seo.titulo} maxLength={70} onChange={(e) => set('seo', { ...c.seo, titulo: e.target.value })} />}</Field>
          <Field label="Descrição" hint={`${c.seo.descricao.length}/170 caracteres`}>{(a) => <Textarea {...a} rows={2} value={c.seo.descricao} maxLength={170} onChange={(e) => set('seo', { ...c.seo, descricao: e.target.value })} />}</Field>
        </div>
      </Card>

      {/* Barra fixa para guardar */}
      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t border-linha bg-superficie/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {alterado && <span className="mr-auto text-xs text-sinal-ambar">Tem alterações por publicar</span>}
        <Button variante="fantasma" disabled={!alterado} onClick={() => setC(inicial)}>Desfazer</Button>
        <Button
          disabled={!alterado}
          carregando={guardar.isPending}
          onClick={() => guardar.mutate(c, {
            onSuccess: (novo) => { setC(novo); toast('Site atualizado — as alterações já estão públicas'); },
            onError: (e) => toast(mensagemErro(e), 'erro'),
          })}
        >
          Publicar alterações
        </Button>
      </div>
    </div>
  );
}

/** Lista editável com acrescentar, remover e reordenar. */
function Lista<T>({ titulo, subtitulo, itens, onChange, novo, render, max }: {
  titulo: string;
  subtitulo: string;
  itens: T[];
  onChange: (v: T[]) => void;
  novo: () => T;
  render: (item: T, mudar: (v: T) => void) => ReactNode;
  max: number;
}) {
  const mover = (i: number, d: number) => {
    const v = [...itens];
    [v[i], v[i + d]] = [v[i + d], v[i]];
    onChange(v);
  };
  return (
    <Card>
      <CardHeader
        title={titulo}
        subtitle={`${subtitulo} · ${itens.length}/${max}`}
        action={<Button variante="secundario" tamanho="sm" icone={<Plus size={14} />} disabled={itens.length >= max} onClick={() => onChange([...itens, novo()])}>Acrescentar</Button>}
      />
      {itens.length === 0 ? <p className="px-5 py-6 text-sm text-mzd-gray">Nenhum.</p> : (
        <ol className="divide-y divide-linha/70">
          {itens.map((x, i) => (
            <li key={i} className="flex gap-3 px-5 py-4">
              <div className="flex shrink-0 flex-col items-center gap-1 pt-6">
                <span className="num text-xs text-mzd-gray">{i + 1}</span>
                <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="rounded p-1 text-mzd-gray hover:bg-zinc-100 hover:text-mzd-black disabled:opacity-30" aria-label={`Subir ${titulo} ${i + 1}`}><ArrowUp size={14} /></button>
                <button type="button" onClick={() => mover(i, 1)} disabled={i === itens.length - 1} className="rounded p-1 text-mzd-gray hover:bg-zinc-100 hover:text-mzd-black disabled:opacity-30" aria-label={`Descer ${titulo} ${i + 1}`}><ArrowDown size={14} /></button>
                <button type="button" onClick={() => onChange(itens.filter((_, k) => k !== i))} className="rounded p-1 text-mzd-gray hover:bg-sinal-vermelho-fundo hover:text-sinal-vermelho" aria-label={`Remover ${titulo} ${i + 1}`}><Trash2 size={14} /></button>
              </div>
              <div className="min-w-0 flex-1">{render(x, (v) => onChange(itens.map((y, k) => (k === i ? v : y))))}</div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** Fotografia com descrição (para leitores de ecrã e Google) e crédito; trocar envia uma imagem nova. */
function EditorImagem({ imagem, onChange, horizontal }: { imagem: ImagemSite; onChange: (v: ImagemSite) => void; horizontal?: boolean }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [aEnviar, setAEnviar] = useState(false);

  async function escolher(f?: File) {
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast('Escolha uma imagem (JPG, PNG ou WebP).', 'erro');
    setAEnviar(true);
    try {
      const blob = await comprimirImagem(f);
      const nova = await api.site.enviarImagem(blob, imagem.alt);
      // Fotografia própria: deixa de ter o crédito da anterior.
      onChange({ ...nova, alt: imagem.alt, credito: undefined });
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setAEnviar(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className={horizontal ? 'grid gap-3 sm:grid-cols-[14rem_1fr]' : 'space-y-2'}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-linha bg-zinc-100">
        <Imagem imagem={imagem} className="h-full w-full object-cover" />
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={aEnviar}
          className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-md bg-mzd-black/80 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-mzd-black"
        >
          <ImagePlus size={13} /> {aEnviar ? 'A enviar…' : 'Trocar'}
        </button>
        <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => escolher(e.target.files?.[0])} />
      </div>
      <div className="space-y-2">
        <Field label="Descrição da fotografia" hint="O que se vê (para quem não a pode ver e para o Google)">
          {(a) => <Input {...a} value={imagem.alt} maxLength={160} onChange={(e) => onChange({ ...imagem, alt: e.target.value })} />}
        </Field>
        {imagem.credito && <Aviso tom="neutro"><span className="text-xs">Crédito: {imagem.credito}</span></Aviso>}
      </div>
    </div>
  );
}
