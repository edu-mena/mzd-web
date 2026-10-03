import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import clsx from 'clsx';
import { ApiError } from '../../api/client';
import { useAlterarMarcacao, useConfiguracao, useMarcacoes, useViaturas } from '../../api/hooks';
import { api } from '../../api/endpoints';
import type { DadosMarcacao } from '../../api/endpoints';
import type { Marcacao, TipoMarcacao, ViaturaResumo } from '../../types';
import { TIPO_MARCACAO_LABEL } from '../../types';
import Drawer from '../../components/ui/Drawer';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Matricula from '../../components/ui/Matricula';
import { Aviso } from '../../components/ui/Controls';
import { Escolha, Field, Input, Select, Textarea } from '../../components/ui/Form';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';
import { diaISO, horaCurta, horariosDoDia } from '../../lib/datas';

const normalizar = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Nova marcação (ou edição). Com `diaInicial` abre já no dia escolhido na agenda. */
export default function FormMarcacao({ marcacao, diaInicial, onFechar }: { marcacao?: Marcacao; diaInicial?: string; onFechar: () => void }) {
  const toast = useToast();
  const alterar = useAlterarMarcacao<Marcacao>();
  const { data: config } = useConfiguracao();
  const { data: viaturas = [] } = useViaturas();
  const [modo, setModo] = useState<'viatura' | 'contacto'>(marcacao && !marcacao.viaturaId ? 'contacto' : 'viatura');
  // undefined = ainda não mexeu (usa a da marcação); null = trocou e ainda não escolheu outra.
  const [viatura, setViatura] = useState<ViaturaResumo | null | undefined>();
  const [q, setQ] = useState('');
  const [contacto, setContacto] = useState({ nome: marcacao?.nome ?? '', telefone: marcacao?.telefone ?? '+244 ', matricula: marcacao?.matricula ?? '' });
  const [dia, setDia] = useState(marcacao ? diaISO(marcacao.data) : diaInicial ?? diaISO(new Date()));
  const [hora, setHora] = useState(marcacao ? horaCurta(marcacao.data) : '08:00');
  const [tipo, setTipo] = useState<TipoMarcacao | undefined>(marcacao?.tipo);
  const [notas, setNotas] = useState(marcacao?.notas ?? '');
  const [cheio, setCheio] = useState<string | null>(null);

  const viaturaAtual = viatura === undefined ? (marcacao?.viaturaId ? viaturas.find((v) => v.id === marcacao.viaturaId) : undefined) : viatura ?? undefined;
  const { data: doDia = [] } = useMarcacoes(dia, dia);
  const ocupadas = doDia.filter((m) => m.id !== marcacao?.id && m.estado !== 'cancelada' && m.estado !== 'faltou');
  const capacidade = config?.capacidadeDiaria ?? 6;
  const horarios = horariosDoDia(dia);
  const resultados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return viaturas.filter((v) => normalizar(v.matricula).includes(normalizar(q)) || v.cliente.nome.toLowerCase().includes(t)).slice(0, 5);
  }, [q, viaturas]);

  function enviar(forcar = false) {
    if (!tipo) return toast('Indique o tipo de serviço.', 'erro');
    if (modo === 'viatura' && !viaturaAtual) return toast('Escolha a viatura ou registe só o contacto.', 'erro');
    const dados: DadosMarcacao = {
      data: new Date(`${dia}T${hora}:00`).toISOString(),
      tipo,
      notas: notas.trim() || undefined,
      forcar,
      ...(modo === 'viatura' ? { viaturaId: viaturaAtual!.id } : { nome: contacto.nome, telefone: contacto.telefone, matricula: contacto.matricula || undefined }),
    };
    alterar.mutate(() => (marcacao ? api.marcacoes.editar(marcacao.id, dados) : api.marcacoes.criar(dados)), {
      onSuccess: (m) => {
        toast(marcacao ? 'Marcação alterada' : `Marcado: ${m.nome}, ${new Date(m.data).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })} às ${horaCurta(m.data)}`);
        onFechar();
      },
      onError: (e) => {
        // 409 = dia cheio: pede confirmação para marcar acima da capacidade.
        if (e instanceof ApiError && e.status === 409) setCheio(e.message);
        else toast(mensagemErro(e), 'erro');
      },
    });
  }

  return (
    <Drawer
      open
      onClose={onFechar}
      titulo={marcacao ? 'Alterar marcação' : 'Nova marcação'}
      rodape={
        <>
          <Button variante="fantasma" onClick={onFechar}>Cancelar</Button>
          <Button onClick={() => enviar(false)} carregando={alterar.isPending}>{marcacao ? 'Guardar' : 'Marcar'}</Button>
        </>
      }
    >
      <div className="space-y-6">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="rotulo">Quem vem</h3>
            <Button variante="fantasma" tamanho="sm" onClick={() => setModo(modo === 'viatura' ? 'contacto' : 'viatura')}>
              {modo === 'viatura' ? 'Ainda não é cliente' : 'Pesquisar viatura registada'}
            </Button>
          </div>
          {modo === 'viatura' ? (
            viaturaAtual ? (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-mzd-black bg-white p-3">
                <Matricula valor={viaturaAtual.matricula} tamanho="sm" />
                <span className="min-w-0 flex-1 text-[13px]">
                  <span className="block font-semibold text-mzd-black">{viaturaAtual.marca} {viaturaAtual.modelo}</span>
                  <span className="block text-mzd-gray">{viaturaAtual.cliente.nome} · <span className="num">{viaturaAtual.cliente.telefone}</span></span>
                </span>
                <Button variante="secundario" tamanho="sm" onClick={() => { setViatura(null); setQ(''); }}>Trocar</Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mzd-gray" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Matrícula ou nome do cliente" className="pl-9" autoFocus aria-label="Pesquisar viatura" />
                </div>
                {resultados.map((v) => (
                  <button key={v.id} type="button" onClick={() => setViatura(v)} className="flex w-full items-center gap-3 rounded-md border border-linha bg-white px-3 py-2 text-left text-[13px] hover:border-zinc-400">
                    <Matricula valor={v.matricula} tamanho="sm" />
                    <span className="font-semibold text-mzd-black">{v.marca} {v.modelo}</span>
                    <span className="ml-auto text-xs text-mzd-gray">{v.cliente.nome}</span>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nome">{(a) => <Input {...a} value={contacto.nome} onChange={(e) => setContacto({ ...contacto, nome: e.target.value })} />}</Field>
              <Field label="Telefone">{(a) => <Input {...a} value={contacto.telefone} onChange={(e) => setContacto({ ...contacto, telefone: e.target.value })} inputMode="tel" className="num" />}</Field>
              <Field label="Matrícula" hint="Opcional">{(a) => <Input {...a} value={contacto.matricula} onChange={(e) => setContacto({ ...contacto, matricula: e.target.value.toUpperCase() })} className="num uppercase" />}</Field>
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Dia">{(a) => <Input {...a} type="date" value={dia} min={marcacao ? undefined : diaISO(new Date())} onChange={(e) => setDia(e.target.value)} className="num" />}</Field>
          <Field label="Hora de chegada">
            {(a) => (
              <Select {...a} value={hora} onChange={(e) => setHora(e.target.value)} disabled={horarios.length === 0} className="num">
                {horarios.length === 0 && <option>Fechado ao domingo</option>}
                {horarios.map((h) => <option key={h} value={h}>{h}</option>)}
              </Select>
            )}
          </Field>
          <div className="sm:col-span-2">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-semibold text-mzd-black">Ocupação do dia</span>
              <span className={clsx('num', ocupadas.length >= capacidade ? 'font-semibold text-sinal-vermelho' : 'text-mzd-gray')}>{ocupadas.length} de {capacidade} entradas</span>
            </div>
            <div className="mt-1.5 flex h-[6px] gap-[2px]" aria-hidden>
              {Array.from({ length: Math.max(capacidade, ocupadas.length) }, (_, i) => (
                <span key={i} className={clsx('flex-1 rounded-[1px]', i < ocupadas.length ? (i >= capacidade ? 'bg-mzd-red' : 'bg-mzd-black') : 'bg-zinc-200')} />
              ))}
            </div>
            {ocupadas.length > 0 && (
              <p className="num mt-1.5 text-[11px] text-mzd-gray">Já marcado: {ocupadas.map((m) => horaCurta(m.data)).join(' · ')}</p>
            )}
          </div>
        </section>

        <Escolha label="Serviço" valor={tipo} onChange={setTipo} opcoes={(Object.keys(TIPO_MARCACAO_LABEL) as TipoMarcacao[]).map((t) => ({ valor: t, label: TIPO_MARCACAO_LABEL[t] }))} />
        <Field label="Notas" hint="Opcional — o que o cliente referiu ao telefone">{(a) => <Textarea {...a} rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />}</Field>
      </div>

      <Modal
        open={!!cheio}
        onClose={() => setCheio(null)}
        title="Dia cheio"
        footer={
          <>
            <Button variante="fantasma" onClick={() => setCheio(null)}>Escolher outro dia</Button>
            <Button variante="perigo" onClick={() => { setCheio(null); enviar(true); }}>Marcar mesmo assim</Button>
          </>
        }
      >
        <Aviso>{cheio}</Aviso>
        <p className="mt-3 text-sm text-mzd-gray">Marcar acima da capacidade pode atrasar as entregas prometidas. Fica registado na auditoria.</p>
      </Modal>
    </Drawer>
  );
}
