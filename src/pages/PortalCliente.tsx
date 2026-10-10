import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Mail, MapPin, MessageCircle, Phone, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { usePortal } from '../api/hooks';
import { ApiError } from '../api/client';
import type { Anexo, PortalProcesso } from '../types';
import { ESTADOS_ORDEM, ESTADO_CLIENTE, METODO_APROVACAO_LABEL } from '../types';
import Matricula from '../components/ui/Matricula';
import Button from '../components/ui/Button';
import { Aviso } from '../components/ui/Controls';
import { MiniaturaAnexo, VisualizadorAnexo } from '../components/ui/Anexos';
import { formatAOA, formatDate, formatDateTime, formatDia } from '../lib/format';
import { diaPorExtenso, linkWhatsApp } from '../lib/mensagens';
import { textoCondicoes } from '../lib/calculos';
import { frasePrincipal, HORARIO_OFICINA, totalDe } from '../lib/portal';
import LinhasOrcamento from './portal/LinhasOrcamento';
import Decisao from './portal/Decisao';
import Coordenadas from './portal/Coordenadas';
import iconMzd from '../assets/icon.png';

const dataLonga = (iso: string) => new Date(iso).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });

/** Página pública que o cliente abre a partir do link enviado por WhatsApp ou email. */
export default function PortalCliente() {
  const { token = '' } = useParams();
  const { data: p, error, isPending } = usePortal(token);

  // Página pessoal: fora dos motores de pesquisa.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  useEffect(() => {
    if (p) document.title = `${p.viatura.matricula} · ${p.oficina.nome}`;
  }, [p]);

  return (
    <div className="min-h-[100dvh] bg-papel">
      <header className="bg-mzd-black text-white">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2.5 px-4">
          <img src={iconMzd} alt="" className="h-8 w-8 rounded-md bg-white object-contain p-0.5" />
          <div className="leading-tight">
            <p className="font-display text-[13px] font-extrabold tracking-wide [font-stretch:120%]">MZD</p>
            <p className="text-[10.5px] text-zinc-400">Carros e Motores · Oficina</p>
          </div>
          {p && (
            <a href={`tel:${p.oficina.telefone.replace(/\s/g, '')}`} className="ml-auto flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">
              <Phone size={13} /> Ligar
            </a>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-10 pt-5">
        {isPending ? (
          <p className="py-20 text-center text-sm text-mzd-gray">A carregar…</p>
        ) : error ? (
          <Indisponivel erro={error} />
        ) : (
          <Conteudo p={p} token={token} />
        )}
      </main>
    </div>
  );
}

function Indisponivel({ erro }: { erro: unknown }) {
  const expirado = erro instanceof ApiError && erro.status === 410;
  return (
    <div className="py-16 text-center">
      <p className="rotulo">{expirado ? 'Link expirado' : 'Link indisponível'}</p>
      <h1 className="mx-auto mt-2 max-w-sm font-display text-2xl font-extrabold text-mzd-black">
        {expirado ? 'Este processo já terminou há algum tempo.' : 'Não encontrámos este processo.'}
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-sm text-mzd-gray">
        {erro instanceof ApiError && erro.status < 500 ? erro.message : 'Não foi possível carregar a página. Tente novamente dentro de momentos.'}
      </p>
    </div>
  );
}

function Seccao({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('rounded-lg border border-linha bg-white px-5 py-4', className)}>
      <h2 className="mb-3 text-[15px] font-extrabold text-mzd-black">{titulo}</h2>
      {children}
    </section>
  );
}

function Conteudo({ p, token }: { p: PortalProcesso; token: string }) {
  const [decisao, setDecisao] = useState<{ decisao: 'aprovado' | 'recusado'; adicionalId?: string; total: number; condicoes?: string } | null>(null);
  const [foto, setFoto] = useState<Anexo | null>(null);
  const frase = frasePrincipal(p);
  const ativo = !['entregue', 'cancelado'].includes(p.estado);
  const o = p.orcamento;
  const porDecidir = p.estado === 'aguarda_aprovacao' && o?.estado === 'enviado';
  const adicionais = p.adicionais.filter((a) => a.estado === 'enviado' && p.estado === 'em_reparacao');
  const whatsapp = linkWhatsApp(p.oficina.telefone, `Olá, sou ${p.cliente.nome.split(' ')[0]} — processo ${p.numero} (${p.viatura.matricula}).`);
  const parqueDia = o ? `${formatAOA(o.condicoes.parqueamentoDia)} por dia${o.taxaIva > 0 ? ' + IVA' : ''}` : '';
  const aPagarLevantamento = (p.valores?.aPagar ?? 0) + (p.parqueamento?.valor ?? 0);

  return (
    <div className="space-y-4">
      {/* Viatura e situação */}
      <section className="pt-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Matricula valor={p.viatura.matricula} tamanho="lg" />
          <div className="leading-tight">
            <p className="text-[15px] font-semibold text-mzd-black">{p.viatura.marca} {p.viatura.modelo}</p>
            <p className="num text-xs text-mzd-gray">Processo {p.numero}</p>
          </div>
        </div>
        <p className={clsx('rotulo mt-5', porDecidir ? '!text-sinal-vermelho' : p.estado === 'pronta_entrega' ? '!text-sinal-verde' : '')}>{ESTADO_CLIENTE[p.estado]}</p>
        <h1 className="mt-1 font-display text-[1.75rem] font-extrabold leading-[1.1] text-mzd-black">{frase.titulo}</h1>
        {frase.texto && <p className="mt-2 text-[15px] text-mzd-graphite">{frase.texto}</p>}
        {ativo && p.estado !== 'pronta_entrega' && (
          <p className="mt-3 text-sm text-mzd-gray">Previsão de entrega: <span className="font-semibold text-mzd-black first-letter:uppercase">{dataLonga(p.prazoEntrega)}</span></p>
        )}
        {p.progresso && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-mzd-gray">
              <span>Trabalhos concluídos</span>
              <span className="num">{p.progresso.feitas} de {p.progresso.total}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full bg-mzd-black transition-all" style={{ width: `${(p.progresso.feitas / p.progresso.total) * 100}%` }} />
            </div>
          </div>
        )}
      </section>

      {/* Decisão pendente: o que o cliente tem de fazer vem primeiro */}
      {porDecidir && o && (
        <Seccao titulo="Diagnóstico e orçamento" className="border-mzd-black">
          {p.diagnostico && (
            <>
              <ul className="space-y-2">
                {p.diagnostico.problemas.map((x, i) => (
                  <li key={i} className="flex gap-3">
                    <span className={clsx('rotulo mt-0.5 h-fit shrink-0 rounded px-1.5 py-px !text-[10px]', x.gravidade === 'critico' ? 'bg-sinal-vermelho-fundo !text-sinal-vermelho' : 'bg-sinal-ambar-fundo !text-sinal-ambar')}>
                      {x.gravidade === 'critico' ? 'Urgente' : 'Atenção'}
                    </span>
                    <span className="text-[14px]"><strong className="font-semibold text-mzd-black">{x.sistema}</strong>{x.observacao && <span className="text-mzd-graphite"> — {x.observacao}</span>}</span>
                  </li>
                ))}
              </ul>
              {p.diagnostico.parecer && <p className="mt-3 border-l-2 border-linha-forte pl-3 text-[13.5px] italic text-mzd-graphite">{p.diagnostico.parecer}</p>}
              <div className="my-4 border-t border-linha" />
            </>
          )}
          <LinhasOrcamento orcamento={o} />

          <div className="mt-4 rounded-md bg-papel px-4 py-3">
            <p className="rotulo mb-1.5">Como se paga</p>
            <dl className="space-y-1 text-[13.5px]">
              <div className="flex justify-between gap-3"><dt className="text-mzd-graphite">Ao aceitar <span className="text-xs text-mzd-gray">(para começarmos)</span></dt><dd className="num font-semibold text-mzd-black">{formatAOA(o.pagamentoAceitacao)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-mzd-graphite">No levantamento</dt><dd className="num font-semibold text-mzd-black">{formatAOA(o.pagamentoLevantamento)}</dd></div>
            </dl>
            <p className="mt-1.5 text-xs text-mzd-gray">{textoCondicoes(o.condicoes)}</p>
          </div>

          {o.expirado ? (
            <div className="mt-4">
              <Aviso>
                O prazo para aceitar terminou{o.validoAte && <> a {formatDate(o.validoAte)}</>}. A viatura está em parqueamento ({parqueDia})
                {p.parqueamento && <>: {p.parqueamento.dias} dia(s), {formatAOA(p.parqueamento.valor)} até hoje</>}. Pode aceitar na mesma.
              </Aviso>
            </div>
          ) : o.validoAte && (
            <p className="mt-3 text-[13px] text-mzd-graphite">
              Pode aceitar até <strong className="first-letter:uppercase">{dataLonga(o.validoAte)}</strong>. Depois dessa data, a viatura fica em parqueamento ({parqueDia}).
            </p>
          )}
          <div className="mt-4 grid gap-2 sm:grid-cols-[2fr_1fr]">
            <Button className="h-12 text-[15px]" icone={<Check size={17} />} onClick={() => setDecisao({ decisao: 'aprovado', total: totalDe(o).total, condicoes: textoCondicoes(o.condicoes) })}>
              Aceitar orçamento
            </Button>
            <Button variante="secundario" className="h-12" onClick={() => setDecisao({ decisao: 'recusado', total: totalDe(o).total })}>Não aceitar</Button>
          </div>
          <p className="mt-2 text-xs text-mzd-gray">Prefere tratar na oficina? Pode assinar a pró-forma ao balcão ou responder ACEITO à nossa mensagem.</p>
        </Seccao>
      )}

      {p.aguardaPagamentoAceitacao !== undefined && (
        <Seccao titulo="Pagamento para começarmos" className="border-mzd-black">
          <p className="text-[14px] text-mzd-graphite">
            Obrigado por aceitar. Para encomendarmos as peças e começarmos a reparação, falta o pagamento de{' '}
            <strong className="num font-display text-lg text-mzd-black">{formatAOA(p.aguardaPagamentoAceitacao)}</strong>.
          </p>
          {p.parqueamento && (
            <p className="mt-2 text-[13px] text-mzd-graphite">
              Há também {formatAOA(p.parqueamento.valor)} de parqueamento ({p.parqueamento.dias} dia(s) depois do prazo para aceitar), a pagar até ao levantamento.
            </p>
          )}
          {p.oficina.coordenadas.length > 0 && (
            <div className="mt-3"><Coordenadas contas={p.oficina.coordenadas} instrucoes={p.oficina.instrucoesPagamento} referencia={p.numero} /></div>
          )}
        </Seccao>
      )}

      {adicionais.map((a) => (
        <Seccao key={a.id} titulo="Trabalho adicional para aprovar" className="border-mzd-black">
          <p className="mb-3 text-[14px] text-mzd-graphite">{a.justificacao}</p>
          <LinhasOrcamento orcamento={a} />
          <div className="mt-4 grid gap-2 sm:grid-cols-[2fr_1fr]">
            <Button className="h-12 text-[15px]" icone={<Check size={17} />} onClick={() => setDecisao({ decisao: 'aprovado', adicionalId: a.id, total: totalDe(a).total })}>Aprovar</Button>
            <Button variante="secundario" className="h-12" onClick={() => setDecisao({ decisao: 'recusado', adicionalId: a.id, total: totalDe(a).total })}>Não aprovar</Button>
          </div>
        </Seccao>
      ))}

      {p.estado === 'pronta_entrega' && (
        <Seccao titulo="Levantamento">
          {aPagarLevantamento > 0 ? (
            <p className="text-[14px] text-mzd-graphite">Valor a pagar no levantamento: <strong className="num font-display text-lg text-mzd-black">{formatAOA(aPagarLevantamento)}</strong></p>
          ) : (
            <p className="text-[14px] text-sinal-verde">O serviço está pago.</p>
          )}
          {p.parqueamento ? (
            <div className="mt-3">
              <Aviso>
                Inclui parqueamento desde {formatDia(p.parqueamento.desde)}: {p.parqueamento.dias} dia(s), {formatAOA(p.parqueamento.valor)} até hoje. Continua a contar até levantar a viatura.
              </Aviso>
            </div>
          ) : p.levantarAte && (
            <p className="mt-2 text-[13.5px] text-mzd-graphite">
              Pode levantar sem custos até <strong className="first-letter:uppercase">{diaPorExtenso(p.levantarAte)}</strong>. Depois disso, aplica-se parqueamento ({parqueDia}).
            </p>
          )}
          <ul className="mt-3 space-y-1.5 text-[13.5px] text-mzd-graphite">
            <li>{HORARIO_OFICINA}</li>
            <li className="flex gap-1.5"><MapPin size={14} className="mt-0.5 shrink-0" /> {p.oficina.morada}</li>
          </ul>
          {aPagarLevantamento > 0 && p.oficina.coordenadas.length > 0 && (
            <div className="mt-3">
              <p className="rotulo mb-1.5">Pagar por transferência</p>
              <Coordenadas contas={p.oficina.coordenadas} instrucoes={p.oficina.instrucoesPagamento} referencia={p.numero} />
            </div>
          )}
        </Seccao>
      )}

      {/* Percurso */}
      <Seccao titulo="Percurso">
        <ol className="relative">
          {ESTADOS_ORDEM.map((e, i) => {
            const passou = p.etapas.find((x) => x.estado === e);
            const atual = e === p.estado;
            const futura = !passou && !atual;
            if (p.estado === 'cancelado' && futura) return null;
            return (
              <li key={e} className="relative flex gap-3 pb-3 last:pb-0">
                {i < ESTADOS_ORDEM.length - 1 && <span className={clsx('absolute left-[7px] top-4 h-full w-px', passou && !atual ? 'bg-mzd-black' : 'bg-linha')} aria-hidden />}
                <span className={clsx('relative mt-0.5 h-[15px] w-[15px] shrink-0 rounded-full border-2',
                  atual ? 'border-mzd-red bg-mzd-red' : passou ? 'border-mzd-black bg-mzd-black' : 'border-linha-forte bg-white')}>
                  {passou && !atual && <Check size={9} strokeWidth={3.5} className="absolute inset-0 m-auto text-white" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
                  <span className={clsx('text-[13.5px]', atual ? 'font-bold text-mzd-black' : futura ? 'text-mzd-gray' : 'text-mzd-black')}>{ESTADO_CLIENTE[e]}</span>
                  {passou && <span className="num text-[11.5px] text-mzd-gray">{formatDateTime(passou.data)}</span>}
                </span>
              </li>
            );
          })}
          {p.canceladoEm && (
            <li className="flex gap-3 pt-1"><span className="h-[15px] w-[15px] shrink-0 rounded-full bg-zinc-400" /><span className="text-[13.5px] font-bold">Encerrado em {formatDate(p.canceladoEm)}</span></li>
          )}
        </ol>
      </Seccao>

      {p.autorizacao && (
        <p className="flex items-start gap-2 px-1 text-xs text-mzd-gray">
          <ShieldCheck size={14} className="mt-px shrink-0 text-sinal-verde" />
          Orçamento aceite por {p.autorizacao.autorizadoPor} em {formatDateTime(p.autorizacao.data)} ({METODO_APROVACAO_LABEL[p.autorizacao.metodo].toLowerCase()}).
        </p>
      )}

      {p.valores && p.estado !== 'pronta_entrega' && (
        <Seccao titulo="Valores">
          <dl className="space-y-1 text-[13.5px]">
            <div className="flex justify-between"><dt className="text-mzd-gray">Total do serviço{o?.isencaoIva ? ' (sem IVA)' : ' (IVA incluído)'}</dt><dd className="num">{formatAOA(p.valores.total)}</dd></div>
            <div className="flex justify-between"><dt className="text-mzd-gray">Pago</dt><dd className="num">{formatAOA(p.valores.pago)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Por pagar</dt><dd className="num">{formatAOA(p.valores.aPagar)}</dd></div>
            {p.parqueamento && <div className="flex justify-between text-mzd-gray"><dt>Parqueamento (à parte)</dt><dd className="num">{formatAOA(p.parqueamento.valor)}</dd></div>}
          </dl>
          {p.valores.fatura && <p className="num mt-2 text-xs text-mzd-gray">Fatura {p.valores.fatura}</p>}
        </Seccao>
      )}

      {o && !porDecidir && o.estado === 'aprovado' && (
        <details className="group rounded-lg border border-linha bg-white px-5 py-4">
          <summary className="cursor-pointer list-none text-[15px] font-extrabold text-mzd-black">
            Orçamento aceite <span className="num ml-1 text-sm font-normal text-mzd-gray">{formatAOA(totalDe(o).total)}</span>
            <span className="float-right text-xs font-semibold text-mzd-gray group-open:hidden">Ver detalhe</span>
          </summary>
          <div className="mt-3"><LinhasOrcamento orcamento={o} /></div>
        </details>
      )}

      {p.fotos.length > 0 && (
        <Seccao titulo="Fotografias">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {p.fotos.map((f) => <MiniaturaAnexo key={f.id} anexo={f} onAbrir={() => setFoto(f)} />)}
          </div>
        </Seccao>
      )}

      <Seccao titulo="O que nos disse na receção">
        <p className="text-[14px] text-mzd-graphite">“{p.queixa}”</p>
        <p className="num mt-1 text-xs text-mzd-gray">Recebida em {formatDateTime(p.criadoEm)}</p>
      </Seccao>

      {/* Contactos */}
      <section className="px-1 pt-2">
        <p className="rotulo mb-2">Dúvidas? Fale connosco</p>
        <div className="flex flex-wrap gap-2">
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center gap-2 rounded-md bg-mzd-black px-4 text-sm font-semibold text-white"><MessageCircle size={15} /> WhatsApp</a>
          <a href={`tel:${p.oficina.telefone.replace(/\s/g, '')}`} className="flex h-10 items-center gap-2 rounded-md border border-linha-forte bg-white px-4 text-sm font-semibold"><Phone size={15} /> <span className="num">{p.oficina.telefone}</span></a>
          <a href={`mailto:${p.oficina.email}?subject=${encodeURIComponent(`Processo ${p.numero}`)}`} className="flex h-10 items-center gap-2 rounded-md border border-linha-forte bg-white px-4 text-sm font-semibold"><Mail size={15} /> Email</a>
        </div>
        <p className="mt-6 text-[11.5px] leading-relaxed text-mzd-gray">
          Esta página é pessoal: não partilhe o link. {p.oficina.nome} · {p.oficina.morada}
        </p>
      </section>

      {decisao && (
        <Decisao token={token} {...decisao} nomeCliente={p.cliente.nome} onFechar={() => setDecisao(null)} />
      )}
      <VisualizadorAnexo anexo={foto} onFechar={() => setFoto(null)} />
    </div>
  );
}
