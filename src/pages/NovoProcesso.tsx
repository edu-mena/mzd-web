import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Plus, Search } from 'lucide-react';
import clsx from 'clsx';
import { useClientes, useCriarProcesso, useMarcacao, useProcessos, useViatura, useViaturas } from '../api/hooks';
import { Carregando } from '../components/ui/Estados';
import type { NovoProcesso as DadosNovoProcesso } from '../api/endpoints';
import type { ClienteResumo, Marcacao, ViaturaResumo } from '../types';
import { TIPO_MARCACAO_LABEL } from '../types';
import { horaCurta } from '../lib/datas';
import { ESTADO_LABEL, estaAtivo } from '../types';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import Matricula from '../components/ui/Matricula';
import { Aviso } from '../components/ui/Controls';
import { Checkbox, Field, Input, Textarea } from '../components/ui/Form';
import { useToast } from '../components/ui/toast-context';
import { mensagemErro } from '../lib/erros';
import { formatDate } from '../lib/format';

// O estado de entrada (km, combustível, danos, pertences) não se regista aqui: o mecânico verifica-o com
// o cliente na ficha de entrada em papel, que se imprime a seguir e se digitaliza depois de assinada.
const PASSOS = ['Viatura e cliente', 'Queixa e prazo'];
const QUEIXAS_FREQUENTES = ['Revisão periódica', 'Ruído ao travar', 'Luz de avaria acesa', 'Ar condicionado não arrefece', 'Fuga de óleo', 'Vibração em andamento'];

const normalizar = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
const emDias = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

interface Estado {
  viatura?: ViaturaResumo;
  novaViatura: { matricula: string; marca: string; modelo: string; ano: string; cor: string; chassi: string };
  modoViatura: 'pesquisa' | 'nova';
  cliente?: ClienteResumo;
  modoCliente: 'pesquisa' | 'novo';
  novoCliente: { nome: string; telefone: string; email: string; nif: string; consentimentoMensagens: boolean };
  queixa: string;
  prazo: string;
  urgente: boolean;
}

const INICIAL: Estado = {
  novaViatura: { matricula: '', marca: '', modelo: '', ano: '', cor: '', chassi: '' },
  modoViatura: 'pesquisa',
  modoCliente: 'pesquisa',
  novoCliente: { nome: '', telefone: '+244 ', email: '', nif: '', consentimentoMensagens: true },
  queixa: '',
  prazo: emDias(3),
  urgente: false,
};

/**
 * `?viatura=<id>` (ficha da viatura): abre com a viatura escolhida.
 * `?marcacao=<id>` (agenda): abre com os dados da marcação; ao abrir o processo, a marcação passa a "chegou".
 */
export default function NovoProcesso() {
  const [params] = useSearchParams();
  const marcacaoId = params.get('marcacao') ?? '';
  const { data: marcacao, isPending: aCarregarMarcacao } = useMarcacao(marcacaoId);
  const viaturaId = marcacao?.viaturaId ?? params.get('viatura') ?? '';
  const { data: viatura, isPending } = useViatura(viaturaId);
  if ((marcacaoId && aCarregarMarcacao) || (viaturaId && isPending)) return <Carregando />;
  return <Assistente viaturaInicial={viaturaId ? viatura : undefined} marcacao={marcacao} />;
}

function estadoInicial(viatura?: ViaturaResumo, m?: Marcacao): Estado {
  if (viatura || !m) return { ...INICIAL, viatura };
  // Marcação de quem ainda não é cliente: pré-preenche viatura nova e cliente novo.
  return {
    ...INICIAL,
    modoViatura: 'nova',
    modoCliente: 'novo',
    novaViatura: { ...INICIAL.novaViatura, matricula: m.matricula ?? '' },
    novoCliente: { ...INICIAL.novoCliente, nome: m.nome, telefone: m.telefone },
  };
}

function Assistente({ viaturaInicial, marcacao }: { viaturaInicial?: ViaturaResumo; marcacao?: Marcacao }) {
  const navigate = useNavigate();
  const toast = useToast();
  const criar = useCriarProcesso();
  const [passo, setPasso] = useState(0);
  const [e, setE] = useState<Estado>(() => estadoInicial(viaturaInicial, marcacao));
  const [erros, setErros] = useState<Record<string, string>>({});
  const [progresso, setProgresso] = useState<string | null>(null);
  const atualizar = (parcial: Partial<Estado>) => setE((x) => ({ ...x, ...parcial }));

  const { data: processos = [] } = useProcessos();
  const processoAtivo = e.viatura ? processos.find((p) => p.viaturaId === e.viatura!.id && estaAtivo(p.estado)) : undefined;

  function validar(n: number): Record<string, string> {
    const r: Record<string, string> = {};
    if (n === 0) {
      if (e.modoViatura === 'pesquisa') {
        if (!e.viatura) r.viatura = 'Pesquise e selecione a viatura, ou registe uma nova.';
        else if (processoAtivo) r.viatura = `Esta viatura já está na oficina (${processoAtivo.numero}).`;
      } else {
        const v = e.novaViatura;
        if (normalizar(v.matricula).length < 5) r.matricula = 'Matrícula inválida.';
        if (v.marca.trim().length < 2) r.marca = 'Indique a marca.';
        if (!v.modelo.trim()) r.modelo = 'Indique o modelo.';
        const ano = Number(v.ano);
        if (!ano || ano < 1950 || ano > new Date().getFullYear() + 1) r.ano = 'Ano inválido.';
        if (v.cor.trim().length < 2) r.cor = 'Indique a cor.';
        if (e.modoCliente === 'pesquisa' && !e.cliente) r.cliente = 'Selecione o proprietário ou registe um novo cliente.';
        if (e.modoCliente === 'novo') {
          if (e.novoCliente.nome.trim().length < 3) r.nome = 'Indique o nome completo.';
          if (e.novoCliente.telefone.replace(/\D/g, '').length < 9) r.telefone = 'Telefone inválido.';
          if (e.novoCliente.email && !/^\S+@\S+\.\S+$/.test(e.novoCliente.email)) r.email = 'Email inválido.';
        }
      }
    }
    if (n === 1) {
      if (e.queixa.trim().length < 5) r.queixa = 'Descreva o problema relatado pelo cliente.';
      if (!e.prazo || e.prazo < emDias(0)) r.prazo = 'O prazo tem de ser hoje ou depois.';
    }
    return r;
  }

  function seguinte() {
    const r = validar(passo);
    setErros(r);
    if (Object.keys(r).length === 0) setPasso((p) => Math.min(p + 1, PASSOS.length - 1));
  }

  async function abrirProcesso() {
    const r = validar(1);
    setErros(r);
    if (Object.keys(r).length) return;

    const dados: DadosNovoProcesso = {
      ficha: { queixaCliente: e.queixa.trim() },
      prazoEntrega: new Date(`${e.prazo}T18:00:00`).toISOString(),
      urgente: e.urgente,
      marcacaoId: marcacao?.id,
    };
    if (e.modoViatura === 'pesquisa') {
      dados.viaturaId = e.viatura!.id;
      dados.clienteId = e.viatura!.cliente.id;
    } else {
      const v = e.novaViatura;
      dados.novaViatura = { matricula: v.matricula, marca: v.marca.trim(), modelo: v.modelo.trim(), ano: Number(v.ano), cor: v.cor.trim(), chassi: v.chassi.trim() };
      if (e.modoCliente === 'pesquisa') dados.clienteId = e.cliente!.id;
      else {
        const c = e.novoCliente;
        dados.novoCliente = {
          nome: c.nome.trim(), telefone: c.telefone.trim(), email: c.email.trim() || undefined, nif: c.nif.trim() || undefined,
          consentimentoMensagens: c.consentimentoMensagens,
        };
      }
    }

    try {
      setProgresso('A abrir o processo…');
      const processo = await criar.mutateAsync(dados);
      toast(`Processo ${processo.numero} aberto — imprima a ficha de entrada para o mecânico`);
      navigate(`/processos/${processo.id}`, { replace: true });
    } catch (err) {
      setProgresso(null);
      toast(mensagemErro(err), 'erro');
    }
  }

  return (
    <div className="pagina mx-auto max-w-4xl space-y-5 pb-20 sm:pb-0">
      <PageHeader
        voltar={marcacao ? { to: '/agenda', label: 'Agenda' } : { to: '/processos', label: 'Processos' }}
        titulo="Nova receção"
        descricao={marcacao
          ? <>Marcação de <strong className="text-mzd-black">{marcacao.nome}</strong> às <span className="num">{horaCurta(marcacao.data)}</span> · {TIPO_MARCACAO_LABEL[marcacao.tipo]}{marcacao.notas ? ` · “${marcacao.notas}”` : ''}</>
          : 'Abre o processo com a queixa do cliente. O estado da viatura fica na ficha de entrada, preenchida pelo mecânico com o cliente.'}
      />

      <ol className="grid grid-cols-2 gap-2" aria-label="Passos">
        {PASSOS.map((nome, i) => (
          <li key={nome} aria-current={i === passo ? 'step' : undefined}>
            <span className={clsx('block h-[5px] rounded-[1px]', i < passo ? 'bg-mzd-black' : i === passo ? 'bg-mzd-red' : 'bg-zinc-200')} />
            <span className="num mt-1.5 block text-[10.5px] text-mzd-gray">{String(i + 1).padStart(2, '0')}</span>
            <span className={clsx('hidden text-[12.5px] font-semibold sm:block', i <= passo ? 'text-mzd-black' : 'text-mzd-gray')}>{nome}</span>
          </li>
        ))}
      </ol>

      {passo === 0 && <PassoViatura e={e} atualizar={atualizar} erros={erros} processoAtivo={processoAtivo ? `${processoAtivo.numero} · ${ESTADO_LABEL[processoAtivo.estado]}` : undefined} />}
      {passo === 1 && <PassoQueixa e={e} atualizar={atualizar} erros={erros} />}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-linha bg-papel/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <Button variante="secundario" icone={<ArrowLeft size={15} />} onClick={() => { setErros({}); setPasso((p) => p - 1); }} disabled={passo === 0 || !!progresso}>
          Anterior
        </Button>
        {progresso && <span className="text-xs text-mzd-gray" role="status">{progresso}</span>}
        {passo < PASSOS.length - 1 ? (
          <Button onClick={seguinte}>Seguinte <ArrowRight size={15} /></Button>
        ) : (
          <Button icone={<Check size={15} />} onClick={abrirProcesso} carregando={!!progresso}>Abrir processo</Button>
        )}
      </div>
    </div>
  );
}

interface PassoProps {
  e: Estado;
  atualizar: (p: Partial<Estado>) => void;
  erros: Record<string, string>;
}

function PassoViatura({ e, atualizar, erros, processoAtivo }: PassoProps & { processoAtivo?: string }) {
  const [q, setQ] = useState('');
  const { data: viaturas = [] } = useViaturas();
  const resultados = useMemo(() => {
    const n = normalizar(q);
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return viaturas
      .filter((v) => normalizar(v.matricula).includes(n) || v.cliente.nome.toLowerCase().includes(t) || v.cliente.telefone.replace(/\D/g, '').includes(t.replace(/\D/g, '') || '§'))
      .slice(0, 6);
  }, [q, viaturas]);

  if (e.modoViatura === 'nova') return <NovaViatura e={e} atualizar={atualizar} erros={erros} />;

  return (
    <Card>
      <CardHeader title="Que viatura entrou?" subtitle="Pesquise pela matrícula, pelo nome ou pelo telefone do cliente" />
      <div className="space-y-4 px-5 py-5">
        {e.viatura ? (
          <div className="flex flex-wrap items-center gap-4 rounded-md border border-mzd-black bg-white p-4">
            <Matricula valor={e.viatura.matricula} tamanho="lg" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-mzd-black">{e.viatura.marca} {e.viatura.modelo} · {e.viatura.ano}</p>
              <p className="text-sm text-mzd-gray">{e.viatura.cliente.nome} · <span className="num">{e.viatura.cliente.telefone}</span></p>
              <p className="num text-xs text-mzd-gray">Último registo: {e.viatura.km.toLocaleString('pt-PT')} km · {e.viatura.nServicos} serviço(s) na MZD</p>
            </div>
            <Button variante="secundario" tamanho="sm" onClick={() => atualizar({ viatura: undefined })}>Trocar</Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mzd-gray" />
              <Input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Ex.: LD-29-82-GH, António, 923…" className="h-12 pl-9 text-base" autoFocus aria-label="Pesquisar viatura" />
            </div>
            {resultados.length > 0 && (
              <ul className="divide-y divide-linha/70 rounded-md border border-linha bg-white">
                {resultados.map((v) => (
                  <li key={v.id}>
                    <button type="button" onClick={() => atualizar({ viatura: v })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50">
                      <Matricula valor={v.matricula} tamanho="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-mzd-black">{v.marca} {v.modelo}</span>
                        <span className="block truncate text-xs text-mzd-gray">{v.cliente.nome}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {q.trim().length >= 2 && resultados.length === 0 && <p className="text-sm text-mzd-gray">Nenhuma viatura encontrada para "{q}".</p>}
          </>
        )}
        {processoAtivo && <Aviso tom="vermelho">Esta viatura já tem um processo em curso: {processoAtivo}.</Aviso>}
        {erros.viatura && !processoAtivo && <p className="text-xs text-sinal-vermelho">{erros.viatura}</p>}
        <div className="border-t border-linha pt-4">
          <Button
            variante="secundario"
            icone={<Plus size={15} />}
            onClick={() => atualizar({ modoViatura: 'nova', viatura: undefined, novaViatura: { ...e.novaViatura, matricula: q.trim().toUpperCase() } })}
          >
            Primeira visita — registar viatura nova
          </Button>
        </div>
      </div>
    </Card>
  );
}

function NovaViatura({ e, atualizar, erros }: PassoProps) {
  const v = e.novaViatura;
  const setV = (p: Partial<Estado['novaViatura']>) => atualizar({ novaViatura: { ...v, ...p } });
  const c = e.novoCliente;
  const setC = (p: Partial<Estado['novoCliente']>) => atualizar({ novoCliente: { ...c, ...p } });
  const [qc, setQc] = useState('');
  const { data: clientes = [] } = useClientes();
  const resultados = qc.trim().length < 2 ? [] : clientes.filter((x) => x.nome.toLowerCase().includes(qc.toLowerCase()) || x.telefone.replace(/\D/g, '').includes(qc.replace(/\D/g, '') || '§')).slice(0, 5);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Viatura nova" action={<Button variante="fantasma" tamanho="sm" onClick={() => atualizar({ modoViatura: 'pesquisa' })}>Pesquisar existente</Button>} />
        <div className="grid grid-cols-2 gap-4 px-5 py-5 sm:grid-cols-3">
          <Field label="Matrícula" erro={erros.matricula}>{(a) => <Input {...a} value={v.matricula} onChange={(ev) => setV({ matricula: ev.target.value.toUpperCase() })} placeholder="LD-00-00-AA" className="num uppercase" />}</Field>
          <Field label="Marca" erro={erros.marca}>{(a) => <Input {...a} value={v.marca} onChange={(ev) => setV({ marca: ev.target.value })} placeholder="Toyota" />}</Field>
          <Field label="Modelo" erro={erros.modelo}>{(a) => <Input {...a} value={v.modelo} onChange={(ev) => setV({ modelo: ev.target.value })} placeholder="Hilux" />}</Field>
          <Field label="Ano" erro={erros.ano}>{(a) => <Input {...a} value={v.ano} onChange={(ev) => setV({ ano: ev.target.value })} inputMode="numeric" className="num" />}</Field>
          <Field label="Cor" erro={erros.cor}>{(a) => <Input {...a} value={v.cor} onChange={(ev) => setV({ cor: ev.target.value })} />}</Field>
          <Field label="Nº de chassi" hint="Opcional">{(a) => <Input {...a} value={v.chassi} onChange={(ev) => setV({ chassi: ev.target.value.toUpperCase() })} className="num" />}</Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Proprietário"
          action={
            <Button variante="fantasma" tamanho="sm" onClick={() => atualizar({ modoCliente: e.modoCliente === 'novo' ? 'pesquisa' : 'novo', cliente: undefined })}>
              {e.modoCliente === 'novo' ? 'Pesquisar cliente existente' : 'Cliente novo'}
            </Button>
          }
        />
        <div className="px-5 py-5">
          {e.modoCliente === 'pesquisa' ? (
            e.cliente ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-mzd-black bg-white p-3">
                <div>
                  <p className="font-semibold text-mzd-black">{e.cliente.nome}</p>
                  <p className="num text-xs text-mzd-gray">{e.cliente.telefone}</p>
                </div>
                <Button variante="secundario" tamanho="sm" onClick={() => atualizar({ cliente: undefined })}>Trocar</Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input value={qc} onChange={(ev) => setQc(ev.target.value)} placeholder="Nome ou telefone do cliente" aria-label="Pesquisar cliente" />
                {resultados.map((x) => (
                  <button key={x.id} type="button" onClick={() => atualizar({ cliente: x })} className="flex w-full items-center justify-between rounded-md border border-linha bg-white px-3 py-2 text-left text-[13px] hover:border-zinc-400">
                    <span className="font-semibold text-mzd-black">{x.nome}</span>
                    <span className="num text-xs text-mzd-gray">{x.telefone}</span>
                  </button>
                ))}
                {erros.cliente && <p className="text-xs text-sinal-vermelho">{erros.cliente}</p>}
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nome completo" erro={erros.nome}>{(a) => <Input {...a} value={c.nome} onChange={(ev) => setC({ nome: ev.target.value })} />}</Field>
              <Field label="Telefone (WhatsApp)" erro={erros.telefone}>{(a) => <Input {...a} value={c.telefone} onChange={(ev) => setC({ telefone: ev.target.value })} inputMode="tel" className="num" />}</Field>
              <Field label="Email" hint="Opcional" erro={erros.email}>{(a) => <Input {...a} value={c.email} onChange={(ev) => setC({ email: ev.target.value })} type="email" />}</Field>
              <Field label="NIF" hint="Opcional — necessário para faturas com NIF">{(a) => <Input {...a} value={c.nif} onChange={(ev) => setC({ nif: ev.target.value })} className="num" />}</Field>
              <Checkbox checked={c.consentimentoMensagens} onChange={(x) => setC({ consentimentoMensagens: x })} className="sm:col-span-2">
                O cliente aceita receber mensagens por WhatsApp e email sobre a viatura
                <span className="block text-xs text-mzd-gray">Exigido pela Lei de Proteção de Dados Pessoais. Pode ser alterado mais tarde.</span>
              </Checkbox>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function PassoQueixa({ e, atualizar, erros }: PassoProps) {
  const matricula = e.viatura?.matricula ?? e.novaViatura.matricula;
  const viatura = e.viatura ? `${e.viatura.marca} ${e.viatura.modelo}` : `${e.novaViatura.marca} ${e.novaViatura.modelo}`;
  const cliente = e.viatura?.cliente.nome ?? e.cliente?.nome ?? e.novoCliente.nome;
  return (
    <div className="space-y-4">
    <Card>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4">
        <Linha label="Viatura"><span className="flex flex-wrap items-center gap-2"><Matricula valor={matricula} tamanho="sm" />{viatura}</span></Linha>
        <Linha label="Cliente">{cliente}</Linha>
      </dl>
    </Card>
    <Card>
      <CardHeader title="O que o cliente relata" subtitle="Escreva nas palavras do cliente — é o ponto de partida do diagnóstico" />
      <div className="space-y-5 px-5 py-5">
        <Field label="Queixa do cliente" erro={erros.queixa}>
          {(a) => <Textarea {...a} rows={4} value={e.queixa} onChange={(ev) => atualizar({ queixa: ev.target.value })} autoFocus placeholder="Ex.: Faz um ruído metálico ao travar, sobretudo de manhã." />}
        </Field>
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {QUEIXAS_FREQUENTES.map((q) => (
            <button key={q} type="button" onClick={() => atualizar({ queixa: e.queixa ? `${e.queixa.trim()} ${q}.` : `${q}.` })} className="rounded-full border border-linha-forte bg-white px-2.5 py-1 text-xs text-mzd-gray hover:border-mzd-black hover:text-mzd-black">
              + {q}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Prazo de entrega prometido" erro={erros.prazo} hint={e.prazo ? `Até às 18h de ${formatDate(`${e.prazo}T12:00:00`)}` : undefined}>
            {(a) => <Input {...a} type="date" value={e.prazo} min={emDias(0)} onChange={(ev) => atualizar({ prazo: ev.target.value })} className="num" />}
          </Field>
          <div className="flex flex-wrap items-end gap-1.5">
            {[1, 2, 3, 5, 7].map((d) => (
              <button key={d} type="button" onClick={() => atualizar({ prazo: emDias(d) })} className={clsx('h-10 rounded-md border px-3 text-xs font-semibold', e.prazo === emDias(d) ? 'border-mzd-black bg-mzd-black text-white' : 'border-linha-forte bg-white text-mzd-gray hover:text-mzd-black')}>
                +{d} {d === 1 ? 'dia' : 'dias'}
              </button>
            ))}
          </div>
        </div>
        <Checkbox checked={e.urgente} onChange={(x) => atualizar({ urgente: x })}>
          Processo urgente
          <span className="block text-xs text-mzd-gray">Aparece destacado no quadro e no painel da oficina.</span>
        </Checkbox>
      </div>
    </Card>
    <Aviso tom="neutro">
      <p className="font-semibold">A seguir</p>
      <ol className="mt-1 list-decimal space-y-0.5 pl-4">
        <li>Imprima a ficha de entrada (botão no processo) e entregue-a ao mecânico.</li>
        <li>O mecânico verifica a viatura com o cliente, preenche a ficha e o cliente assina.</li>
        <li>Digitalize a ficha assinada e carregue-a no processo, com os quilómetros.</li>
      </ol>
    </Aviso>
    </div>
  );
}

function Linha({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="rotulo">{label}</dt>
      <dd className="mt-0.5 text-[13.5px] font-medium text-mzd-black">{children}</dd>
    </div>
  );
}
