import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Clock, Mail, MapPin, Menu, MessageCircle, Phone, X } from 'lucide-react';
import clsx from 'clsx';
import { useSite } from '../api/hooks';
import { useAuth } from '../auth/useAuth';
import { linkWhatsApp } from '../lib/mensagens';
import { AVISO_MARCA, CREDITOS_FOTOGRAFIAS } from '../lib/site';
import type { ConteudoSite } from '../types';
import { Galeria, Imagem, TituloSeccao } from './site/Partes';
import FormPedido from './site/FormPedido';
import Modal from '../components/ui/Modal';
import iconMzd from '../assets/icon.png';

const NAV = [
  { id: 'modelos', label: 'Mitsubishi' },
  { id: 'servicos', label: 'Serviços' },
  { id: 'como-funciona', label: 'Como funciona' },
  { id: 'oficina', label: 'Oficina' },
  { id: 'contactos', label: 'Contactos' },
];

const PASSOS = [
  { titulo: 'Pede o orçamento', texto: 'Pelo formulário, por WhatsApp ou por telefone. Combinamos o dia em que traz a viatura.' },
  { titulo: 'Diagnóstico com fotografias', texto: 'Inspecionamos cada sistema e registamos o que encontrámos, com fotografias.' },
  { titulo: 'Aprova pelo telemóvel', texto: 'Recebe um link pessoal com o diagnóstico e o orçamento. Só avançamos depois do seu "sim".' },
  { titulo: 'Acompanha e levanta', texto: 'Vê cada etapa em tempo real e é avisado quando a viatura está pronta, com garantia escrita.' },
];

/** Página pública da oficina (o que se vê em mzd.it.ao sem sessão iniciada). */
export default function Site() {
  const { data: site, isPending } = useSite();
  if (isPending || !site) {
    return <div className="site-publico flex min-h-[100dvh] items-center justify-center bg-mzd-black"><img src={iconMzd} alt="MZD" className="h-12 w-12 animate-pulse rounded-md bg-white p-1" /></div>;
  }
  return <Pagina site={site} />;
}

function Pagina({ site }: { site: ConteudoSite }) {
  const { user } = useAuth();
  const [rolou, setRolou] = useState(false);
  const [menu, setMenu] = useState(false);
  const [modelo, setModelo] = useState('');
  const [servico, setServico] = useState('');
  const [ativo, setAtivo] = useState(0);
  const [creditos, setCreditos] = useState(false);
  const zap = linkWhatsApp(site.contactos.whatsapp, 'Olá, gostaria de pedir um orçamento para o meu Mitsubishi.');
  const m = site.modelos[ativo] ?? site.modelos[0];

  useEffect(() => {
    const f = () => setRolou(window.scrollY > 40);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);

  // SEO: título e descrição definidos pelo administrador.
  useEffect(() => {
    document.title = site.seo.titulo;
    document.querySelector('meta[name="description"]')?.setAttribute('content', site.seo.descricao);
  }, [site.seo]);

  const pedir = (p: { modelo?: string; servico?: string }) => {
    if (p.modelo !== undefined) setModelo(p.modelo);
    if (p.servico !== undefined) setServico(p.servico);
    document.getElementById('pedido')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const imagens = [site.hero.imagem, ...site.modelos.map((x) => x.imagem), ...site.servicos.map((x) => x.imagem), ...site.galeria];
  const creditados = imagens.filter((i, k) => i.credito && imagens.findIndex((j) => j.url === i.url) === k);

  return (
    <div className="site-publico bg-papel text-mzd-black">
      <a href="#conteudo-site" className="sr-only z-[60] rounded-md bg-white px-4 py-2 text-sm font-semibold text-mzd-black focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Saltar para o conteúdo</a>

      {/* Navegação: transparente sobre a fotografia, sólida depois de rolar */}
      <header className={clsx('fixed inset-x-0 top-0 z-40 transition-colors duration-300', rolou || menu ? 'bg-mzd-black/95 backdrop-blur-md' : 'bg-gradient-to-b from-black/60 to-transparent')}>
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <a href="#topo" className="flex items-center gap-2.5 text-white">
            <img src={iconMzd} alt="" className="h-8 w-8 rounded-md bg-white object-contain p-0.5" />
            <span className="leading-tight">
              <span className="block font-display text-[15px] font-extrabold tracking-wide [font-stretch:125%]">MZD</span>
              <span className="block text-[10.5px] text-zinc-300">Carros e Motores</span>
            </span>
          </a>
          <nav aria-label="Secções" className="ml-auto hidden lg:block">
            <ul className="flex items-center gap-7">
              {NAV.map((n) => <li key={n.id}><a href={`#${n.id}`} className="text-[13.5px] font-medium text-zinc-200 transition-colors hover:text-white">{n.label}</a></li>)}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Link to={user ? '/' : '/login'} className="hidden h-9 items-center rounded-[3px] px-3 text-[13px] font-semibold text-zinc-200 hover:text-white sm:flex">
              {user ? 'Ir para o painel' : 'Área reservada'}
            </Link>
            <a href="#pedido" className="hidden h-9 items-center gap-1.5 rounded-[3px] bg-mzd-red px-4 text-[13px] font-bold text-white hover:bg-mzd-redDark sm:inline-flex">
              Pedir orçamento
            </a>
            <button type="button" onClick={() => setMenu((v) => !v)} className="rounded-md p-2 text-white lg:hidden" aria-label={menu ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menu}>
              {menu ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {menu && (
          <nav aria-label="Secções" className="border-t border-white/10 px-4 pb-5 pt-2 lg:hidden">
            <ul>
              {NAV.map((n) => <li key={n.id}><a href={`#${n.id}`} onClick={() => setMenu(false)} className="block py-3 text-lg font-semibold text-white">{n.label}</a></li>)}
            </ul>
            <div className="mt-3 flex gap-2">
              <a href="#pedido" onClick={() => setMenu(false)} className="flex h-11 flex-1 items-center justify-center rounded-[3px] bg-mzd-red text-sm font-bold text-white">Pedir orçamento</a>
              <Link to={user ? '/' : '/login'} className="flex h-11 flex-1 items-center justify-center rounded-[3px] border border-white/20 text-sm font-semibold text-white">{user ? 'Painel' : 'Área reservada'}</Link>
            </div>
          </nav>
        )}
      </header>

      <main id="conteudo-site">
        {/* Abertura */}
        <section id="topo" aria-labelledby="titulo-site" className="relative flex min-h-[100svh] items-end overflow-hidden bg-mzd-black text-white">
          <div className="absolute inset-0">
            <Imagem imagem={site.hero.imagem} prioridade className="zoom-lento h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-mzd-black via-mzd-black/55 to-mzd-black/10" />
          </div>
          <div className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-32 sm:px-6 sm:pb-24 lg:px-8">
            <p className="num text-xs tracking-[0.25em] text-zinc-300"><span className="mr-2 inline-block h-px w-8 bg-mzd-red align-middle" />LUANDA · ANGOLA</p>
            <h1 id="titulo-site" className="mt-5 max-w-4xl font-display text-[clamp(2.6rem,8vw,6.2rem)] font-extrabold leading-[0.95] [font-stretch:125%]">
              {site.hero.titulo.replace(/\.$/, '')}<span className="text-mzd-red">.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-[clamp(1rem,1.6vw,1.2rem)] leading-relaxed text-zinc-200">{site.hero.subtitulo}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#pedido" className="group inline-flex h-13 items-center gap-2 rounded-[3px] bg-mzd-red px-7 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-mzd-redDark">
                Pedir orçamento <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </a>
              <a href={zap} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-[3px] border border-white/30 px-6 py-3.5 text-[15px] font-semibold text-white backdrop-blur-sm transition-colors hover:border-white hover:bg-white/10">
                <MessageCircle size={18} /> Falar por WhatsApp
              </a>
            </div>
          </div>
        </section>

        {/* Destaques */}
        <section aria-label="Como trabalhamos" className="border-b border-linha bg-white">
          <ul className="mx-auto grid max-w-7xl gap-px bg-linha sm:grid-cols-3">
            {site.destaques.map((d, i) => (
              <li key={d.titulo} className="revelar bg-white px-6 py-8 sm:px-8 sm:py-10">
                <p className="num text-xs text-sinal-vermelho">{String(i + 1).padStart(2, '0')}</p>
                <h2 className="mt-2 text-lg font-extrabold text-mzd-black">{d.titulo}</h2>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-mzd-graphite">{d.texto}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Modelos: escolher um mostra a fotografia e leva o modelo para o pedido */}
        {site.modelos.length > 0 && (
          <section id="modelos" aria-labelledby="t-modelos" className="mx-auto max-w-7xl scroll-mt-16 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
            <TituloSeccao numero="01" rotulo="Mitsubishi" id="t-modelos" titulo="Conhecemos cada modelo por dentro.">
              Do Pajero à L200, sabemos onde cada um costuma falhar e como o deixar pronto para a estrada e para a picada.
            </TituloSeccao>
            <div className="revelar mt-12 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
              <div role="tablist" aria-label="Modelos Mitsubishi" className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0">
                {site.modelos.map((x, i) => (
                  <button
                    key={x.id}
                    type="button"
                    role="tab"
                    aria-selected={i === ativo}
                    aria-controls="painel-modelo"
                    onClick={() => setAtivo(i)}
                    onMouseEnter={() => setAtivo(i)}
                    className={clsx(
                      'group shrink-0 text-left transition-colors lg:border-b lg:border-linha lg:py-5',
                      'rounded-full border px-4 py-2 lg:rounded-none lg:border-x-0 lg:border-t-0 lg:px-0',
                      i === ativo ? 'border-mzd-black bg-mzd-black text-white lg:bg-transparent lg:text-mzd-black' : 'border-linha-forte text-mzd-gray hover:text-mzd-black',
                    )}
                  >
                    <span className="flex items-baseline gap-4">
                      <span className={clsx('num hidden text-xs lg:inline', i === ativo ? 'text-sinal-vermelho' : 'text-mzd-gray')}>{String(i + 1).padStart(2, '0')}</span>
                      <span className="whitespace-nowrap font-display text-sm font-extrabold lg:text-[1.7rem] lg:[font-stretch:115%]">{x.nome}</span>
                      <ArrowRight size={20} className={clsx('ml-auto hidden transition-all lg:block', i === ativo ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0')} />
                    </span>
                  </button>
                ))}
              </div>
              <div id="painel-modelo" role="tabpanel" aria-label={m.nome} className="relative">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[3px] bg-zinc-200">
                  {site.modelos.map((x, i) => (
                    <Imagem key={x.id} imagem={x.imagem} className={clsx('absolute inset-0 h-full w-full object-cover transition-opacity duration-500', i === ativo ? 'opacity-100' : 'opacity-0')} />
                  ))}
                  <span className="absolute left-0 top-0 h-1 w-16 bg-mzd-red" aria-hidden />
                </div>
                <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
                  <p className="max-w-lg text-[15.5px] leading-relaxed text-mzd-graphite">{m.descricao}</p>
                  <button type="button" onClick={() => pedir({ modelo: m.nome })} className="group inline-flex items-center gap-1.5 text-[14px] font-bold text-mzd-black underline decoration-mzd-red decoration-2 underline-offset-[6px]">
                    Pedir serviço para o {m.nome} <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Serviços */}
        <section id="servicos" aria-labelledby="t-servicos" className="scroll-mt-16 bg-mzd-black py-20 text-white sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <TituloSeccao numero="02" rotulo="Serviços" id="t-servicos" titulo="Tudo o que o seu Mitsubishi precisa." claro>
              Cada trabalho começa com um diagnóstico e um orçamento que aprova antes de mexermos na viatura.
            </TituloSeccao>
            <ul className="mt-12 grid gap-px overflow-hidden rounded-[3px] bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
              {site.servicos.map((s, i) => (
                <li key={s.id} className="revelar group relative bg-mzd-black">
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <Imagem imagem={s.imagem} className="h-full w-full object-cover opacity-70 transition duration-700 group-hover:scale-105 group-hover:opacity-90" />
                    <div className="absolute inset-0 bg-gradient-to-t from-mzd-black to-transparent" />
                    <span className="num absolute left-5 top-4 text-xs text-zinc-300">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <div className="relative -mt-10 px-5 pb-6">
                    <h3 className="font-display text-xl font-extrabold [font-stretch:110%]">{s.titulo}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-zinc-300">{s.descricao}</p>
                    <button type="button" onClick={() => pedir({ servico: s.titulo })} className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-white underline decoration-mzd-red decoration-2 underline-offset-[6px]">
                      Pedir este serviço <ArrowRight size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" aria-labelledby="t-como" className="mx-auto max-w-7xl scroll-mt-16 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <TituloSeccao numero="03" rotulo="Como funciona" id="t-como" titulo="Sem surpresas na fatura.">
            Sabe sempre o que se passa com a sua viatura — e nada é feito sem a sua aprovação.
          </TituloSeccao>
          <ol className="mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
            {PASSOS.map((p, i) => (
              <li key={p.titulo} className="revelar relative">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-mzd-black font-display text-sm font-extrabold">{i + 1}</span>
                  {i < PASSOS.length - 1 && <span className="hidden h-px flex-1 bg-linha-forte md:block" aria-hidden />}
                </div>
                <h3 className="mt-5 text-lg font-extrabold text-mzd-black">{p.titulo}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-mzd-graphite">{p.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Galeria */}
        {site.galeria.length > 0 && (
          <section id="oficina" aria-labelledby="t-oficina" className="scroll-mt-16 border-t border-linha bg-white py-20 sm:py-28">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <TituloSeccao numero="04" rotulo="A oficina" id="t-oficina" titulo="Trabalho feito com cuidado." />
              <div className="mt-12"><Galeria imagens={site.galeria} /></div>
            </div>
          </section>
        )}

        {/* Testemunhos (só os reais, inseridos pelo administrador) */}
        {site.testemunhos.length > 0 && (
          <section aria-labelledby="t-clientes" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
            <TituloSeccao numero="05" rotulo="Clientes" id="t-clientes" titulo="O que dizem de nós." />
            <ul className="mt-10 grid gap-4 md:grid-cols-3">
              {site.testemunhos.map((t) => (
                <li key={t.id} className="revelar rounded-[3px] border border-linha bg-white p-6">
                  <blockquote className="text-[15px] leading-relaxed text-mzd-graphite">“{t.texto}”</blockquote>
                  <p className="mt-4 text-sm font-bold text-mzd-black">{t.nome}{t.viatura && <span className="font-normal text-mzd-gray"> · {t.viatura}</span>}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Pedido e contactos */}
        <section id="contactos" aria-labelledby="t-contactos" className="scroll-mt-16 bg-zinc-100 py-20 sm:py-28">
          <div id="pedido" className="mx-auto grid max-w-7xl scroll-mt-20 gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:px-8">
            <div>
              <TituloSeccao numero={site.testemunhos.length ? '06' : '05'} rotulo="Contactos" id="t-contactos" titulo="Peça o seu orçamento.">
                Diga-nos o que se passa com a viatura. Ligamos-lhe para combinar o dia e o diagnóstico.
              </TituloSeccao>
              <ul className="revelar mt-8 space-y-4 text-[15px]">
                <li><a href={`tel:${site.contactos.telefone.replace(/\s/g, '')}`} className="flex items-center gap-3 font-semibold text-mzd-black hover:underline"><Phone size={18} className="text-mzd-red" /> <span className="num">{site.contactos.telefone}</span></a></li>
                <li><a href={zap} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 font-semibold text-mzd-black hover:underline"><MessageCircle size={18} className="text-mzd-red" /> WhatsApp <span className="num font-normal text-mzd-gray">{site.contactos.whatsapp}</span></a></li>
                <li><a href={`mailto:${site.contactos.email}`} className="flex items-center gap-3 font-semibold text-mzd-black hover:underline"><Mail size={18} className="text-mzd-red" /> {site.contactos.email}</a></li>
                <li className="flex items-start gap-3 text-mzd-graphite"><MapPin size={18} className="mt-0.5 shrink-0 text-mzd-red" />
                  <span>{site.contactos.morada}{site.contactos.mapaUrl && <> · <a href={site.contactos.mapaUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-mzd-black underline underline-offset-4">Ver no mapa</a></>}</span>
                </li>
                <li className="flex items-start gap-3 text-mzd-graphite"><Clock size={18} className="mt-0.5 shrink-0 text-mzd-red" /> {site.contactos.horario}</li>
              </ul>
            </div>
            <div className="revelar">
              <FormPedido
                modelos={site.modelos.map((x) => x.nome)}
                servicos={site.servicos.map((x) => x.titulo)}
                modelo={modelo}
                setModelo={setModelo}
                servico={servico}
                setServico={setServico}
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-mzd-black text-zinc-400">
        <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-8 px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-sm">
            <p className="font-display text-xl font-extrabold text-white [font-stretch:125%]">MZD<span className="text-mzd-red">.</span></p>
            <p className="mt-1 text-sm">Carros e Motores · Especialistas em Mitsubishi</p>
            <p className="mt-4 text-xs leading-relaxed">{AVISO_MARCA}</p>
          </div>
          <nav aria-label="Rodapé">
            <ul className="space-y-2 text-sm">
              {NAV.map((n) => <li key={n.id}><a href={`#${n.id}`} className="hover:text-white">{n.label}</a></li>)}
            </ul>
          </nav>
          <div className="space-y-2 text-sm">
            <Link to={user ? '/' : '/login'} className="block font-semibold text-white hover:underline">{user ? 'Ir para o painel' : 'Área reservada'}</Link>
            <button type="button" onClick={() => setCreditos(true)} className="block hover:text-white">Créditos das fotografias</button>
          </div>
        </div>
        <p className="border-t border-white/10 px-4 py-5 text-center text-xs">© {new Date().getFullYear()} MZD Carros e Motores · Luanda, Angola</p>
      </footer>

      {/* WhatsApp sempre à mão */}
      <aside aria-label="Contacto rápido">
      <a
        href={zap}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar connosco por WhatsApp"
        className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-sinal-verde text-white shadow-flutuante transition-transform hover:scale-105"
      >
        <MessageCircle size={26} />
      </a>
      </aside>

      <Modal open={creditos} onClose={() => setCreditos(false)} title="Créditos das fotografias">
        <p className="text-sm text-mzd-graphite">Fotografias com licença livre, publicadas no Wikimedia Commons e usadas de acordo com cada licença.</p>
        <ul className="mt-4 divide-y divide-linha text-[13px]">
          {creditados.map((i) => (
            <li key={i.url} className="py-2.5">
              <span className="block font-semibold text-mzd-black">{i.alt}</span>
              <span className="text-mzd-gray">{i.credito}</span>
              {(() => {
                const c = CREDITOS_FOTOGRAFIAS.find((x) => x.ficheiro === i.url);
                return c && (
                  <span className="block text-xs">
                    <a href={c.origem} target="_blank" rel="noopener noreferrer" className="text-mzd-black underline underline-offset-2">Original</a>
                    {c.licencaUrl && <> · <a href={c.licencaUrl} target="_blank" rel="noopener noreferrer" className="text-mzd-black underline underline-offset-2">Licença</a></>}
                  </span>
                );
              })()}
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
