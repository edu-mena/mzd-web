import { useEffect, useState } from 'react';
import { Clock, Pause, Play, Plus, PackageCheck, PackageX } from 'lucide-react';
import clsx from 'clsx';
import { useAcaoProcesso, useUtilizadores } from '../../api/hooks';
import { api } from '../../api/endpoints';
import { useAuth } from '../../auth/useAuth';
import type { OrcamentoAdicional, ProcessoDetalhado } from '../../types';
import Button from '../../components/ui/Button';
import Kz from '../../components/ui/Kz';
import { Aviso } from '../../components/ui/Controls';
import { Checkbox, Field, Input, Select } from '../../components/ui/Form';
import Modal from '../../components/ui/Modal';
import { formatDateTime } from '../../lib/format';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';
import { calcularTotais, horasTrabalhadas } from '../../lib/calculos';
import { FormAdicional } from './FormOrcamento';
import { DecisaoAdicional } from './FormAprovacao';

function duracao(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
}

/** Trabalho na oficina: cronómetro, tarefas, peças em falta e trabalhos adicionais. */
export default function Reparacao({ processo }: { processo: ProcessoDetalhado }) {
  const { user, can } = useAuth();
  const toast = useToast();
  const acao = useAcaoProcesso();
  const [agora, setAgora] = useState(() => Date.now());
  const [notaPecas, setNotaPecas] = useState('');
  const [pedirPecas, setPedirPecas] = useState(false);
  const [adicionalAberto, setAdicionalAberto] = useState(false);
  const [decidir, setDecidir] = useState<OrcamentoAdicional | null>(null);
  // Marcação otimista das tarefas: o mecânico vê o visto de imediato; desfaz-se se o servidor recusar.
  const [otimista, setOtimista] = useState<Record<string, boolean>>({});

  const executar = can('reparacao.executar') && (user?.perfil !== 'mecanico' || processo.mecanicoId === user.id);
  // O cronómetro é de quem trabalha; quem gere o processo (ex.: a receção) regista as horas em nome do técnico.
  const ehMecanico = user?.perfil === 'mecanico';
  const [registarHoras, setRegistarHoras] = useState(false);
  const { data: utilizadores = [] } = useUtilizadores();
  const registos = [...(processo.registosTempo ?? [])].filter((r) => r.fim).sort((a, b) => b.fim!.localeCompare(a.fim!));
  const nome = (id?: string) => utilizadores.find((x) => x.id === id)?.nome ?? '—';
  const meu = (processo.registosTempo ?? []).find((r) => !r.fim && r.mecanicoId === user?.id);
  const tarefas = processo.tarefas ?? [];
  const feita = (t: (typeof tarefas)[number]) => otimista[t.id] ?? t.feita;
  const feitas = tarefas.filter(feita).length;
  const horasOrcadas = [...(processo.orcamento?.maoObra ?? []), ...(processo.orcamentosAdicionais ?? []).filter((a) => a.estado === 'aprovado').flatMap((a) => a.maoObra)]
    .reduce((s, m) => s + m.horas, 0);
  const horas = horasTrabalhadas(processo, agora);

  useEffect(() => {
    if (!meu) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [meu]);

  const correr = (fn: () => Promise<ProcessoDetalhado>, ok?: string) =>
    acao.mutate(fn, { onSuccess: () => ok && toast(ok), onError: (e) => toast(mensagemErro(e), 'erro') });

  return (
    <div className="space-y-5">
      {/* Cronómetro e horas */}
      <div className="flex flex-wrap items-center gap-4 rounded-md border border-linha bg-white p-4">
        <div>
          <p className="rotulo">Horas trabalhadas</p>
          <p className="mt-0.5 text-lg font-semibold">
            <span className="num">{horas.toLocaleString('pt-PT')} h</span>
            <span className="text-sm font-normal text-mzd-gray"> de <span className="num">{horasOrcadas.toLocaleString('pt-PT')} h</span> orçamentadas</span>
          </p>
          {horasOrcadas > 0 && horas > horasOrcadas && <p className="text-xs font-semibold text-sinal-ambar">Acima do tempo orçamentado</p>}
        </div>
        {executar && !ehMecanico && (
          <Button variante="secundario" className="ml-auto" icone={<Clock size={15} />} onClick={() => setRegistarHoras(true)}>Registar horas</Button>
        )}
        {executar && ehMecanico && (
          <div className="ml-auto flex items-center gap-3">
            {meu && <span className="num text-xl font-semibold text-mzd-black" aria-live="off">{duracao(agora - new Date(meu.inicio).getTime())}</span>}
            <Button
              variante={meu ? 'perigo' : 'primario'}
              icone={meu ? <Pause size={15} /> : <Play size={15} />}
              carregando={acao.isPending}
              onClick={() => correr(() => api.processos.cronometro(processo.id, meu ? 'parar' : 'iniciar'), meu ? 'Cronómetro parado' : 'Cronómetro iniciado')}
            >
              {meu ? 'Parar trabalho' : 'Iniciar trabalho'}
            </Button>
          </div>
        )}
      </div>

      {registos.length > 0 && (
        <details className="rounded-md border border-linha bg-white px-4 py-2.5 text-[13px]">
          <summary className="cursor-pointer text-xs font-semibold text-mzd-gray">Registos de horas ({registos.length})</summary>
          <ul className="mt-2 divide-y divide-linha/70">
            {registos.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-x-3 py-1.5">
                <span className="text-mzd-black">{nome(r.mecanicoId)}{r.nota && <span className="text-mzd-gray"> · {r.nota}</span>}</span>
                <span className="num text-xs text-mzd-gray">
                  {((new Date(r.fim!).getTime() - new Date(r.inicio).getTime()) / 3600000).toLocaleString('pt-PT', { maximumFractionDigits: 2 })} h · {formatDateTime(r.fim!)}
                  {r.registadoPorId && ` · registado por ${nome(r.registadoPorId)}`}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {registarHoras && <FormHoras processo={processo} onFechar={() => setRegistarHoras(false)} />}

      {/* Peças em falta */}
      {processo.aguardaPecas ? (
        <Aviso icone={<PackageX size={16} />}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span><strong>Parado à espera de peças.</strong> {processo.notaPecas}</span>
            {executar && (
              <Button variante="secundario" tamanho="sm" icone={<PackageCheck size={14} />} onClick={() => correr(() => api.processos.definirPecasEmFalta(processo.id, false), 'Reparação retomada')}>
                Peças chegaram
              </Button>
            )}
          </div>
        </Aviso>
      ) : executar && (
        pedirPecas ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input value={notaPecas} onChange={(e) => setNotaPecas(e.target.value)} placeholder="Que peças faltam? Ex.: amortecedor traseiro, encomendado" className="min-w-0 flex-1" autoFocus aria-label="Peças em falta" />
            <Button variante="secundario" onClick={() => setPedirPecas(false)}>Cancelar</Button>
            <Button onClick={() => correr(() => api.processos.definirPecasEmFalta(processo.id, true, notaPecas), 'Marcado como à espera de peças')} disabled={notaPecas.trim().length < 3}>Parar à espera</Button>
          </div>
        ) : (
          <Button variante="fantasma" tamanho="sm" icone={<PackageX size={14} />} onClick={() => setPedirPecas(true)}>Faltam peças para continuar</Button>
        )
      )}

      {/* Tarefas */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="rotulo">Tarefas</h3>
          <span className="num text-xs text-mzd-gray">{feitas}/{tarefas.length} feitas</span>
        </div>
        <div className="mb-3 h-[5px] rounded-[1px] bg-zinc-100">
          <div className="h-full rounded-[1px] bg-mzd-black transition-all" style={{ width: `${tarefas.length ? (feitas / tarefas.length) * 100 : 0}%` }} />
        </div>
        <ul className="space-y-1.5">
          {tarefas.map((t) => (
            <li key={t.id} className={clsx('rounded-md border px-3 py-2.5', t.descricao.startsWith('Corrigir:') ? 'border-mzd-red/40 bg-sinal-vermelho-fundo/40' : 'border-linha bg-white')}>
              <Checkbox
                checked={feita(t)}
                disabled={!executar}
                onChange={(v) => {
                  setOtimista((o) => ({ ...o, [t.id]: v }));
                  acao.mutate(() => api.processos.marcarTarefa(processo.id, t.id, v), {
                    onError: (e) => toast(mensagemErro(e), 'erro'),
                    onSettled: () => setOtimista((o) => {
                      const resto = { ...o };
                      delete resto[t.id];
                      return resto;
                    }),
                  });
                }}
              >
                <span className={clsx(feita(t) && 'text-mzd-gray line-through decoration-zinc-400')}>{t.descricao}</span>
                {t.adicionalId && <span className="rotulo ml-2">adicional</span>}
              </Checkbox>
            </li>
          ))}
        </ul>
      </section>

      {/* Trabalhos adicionais */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="rotulo">Trabalhos adicionais</h3>
          {can('orcamento.editar') && can('valores.ver') && (
            <Button variante="fantasma" tamanho="sm" icone={<Plus size={14} />} onClick={() => setAdicionalAberto(true)}>Propor trabalho adicional</Button>
          )}
        </div>
        {(processo.orcamentosAdicionais ?? []).length === 0 ? (
          <p className="text-xs text-mzd-gray">Se durante a reparação aparecer algo fora do orçamento, proponha aqui — só se faz depois de o cliente aprovar.</p>
        ) : (
          <ul className="space-y-1.5">
            {processo.orcamentosAdicionais!.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-md border border-linha bg-white px-3 py-2.5 text-[13px]">
                <span className="min-w-0 flex-1 text-mzd-black">{a.justificacao}</span>
                {can('valores.ver') && <Kz valor={calcularTotais(a).total} className="text-mzd-gray" />}
                <span className={clsx('rotulo', a.estado === 'aprovado' && '!text-sinal-verde', a.estado === 'recusado' && '!text-sinal-vermelho', a.estado === 'enviado' && '!text-sinal-ambar')}>
                  {a.estado === 'enviado' ? 'Aguarda cliente' : a.estado}
                </span>
                {a.estado === 'enviado' && can('aprovacao.registar') && (
                  <Button variante="secundario" tamanho="sm" onClick={() => setDecidir(a)}>Registar decisão</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {adicionalAberto && <FormAdicional processo={processo} onFechar={() => setAdicionalAberto(false)} />}
      {decidir && <DecisaoAdicional processo={processo} adicional={decidir} onFechar={() => setDecidir(null)} />}
    </div>
  );
}

/** Horas já trabalhadas por um técnico, registadas por quem gere o processo. */
function FormHoras({ processo, onFechar }: { processo: ProcessoDetalhado; onFechar: () => void }) {
  const toast = useToast();
  const acao = useAcaoProcesso();
  const { data: utilizadores = [] } = useUtilizadores();
  const tecnicos = utilizadores.filter((u) => u.perfil === 'mecanico' && u.ativo);
  const [mecanicoId, setMecanicoId] = useState(processo.mecanicoId ?? '');
  const [horas, setHoras] = useState('');
  const [nota, setNota] = useState('');
  const valor = Number(horas.replace(',', '.'));
  const valido = !!mecanicoId && valor >= 0.25 && valor <= 24;

  return (
    <Modal
      open
      onClose={onFechar}
      title="Registar horas de trabalho"
      footer={
        <>
          <Button variante="fantasma" onClick={onFechar}>Cancelar</Button>
          <Button
            disabled={!valido}
            carregando={acao.isPending}
            onClick={() => acao.mutate(() => api.processos.registarHoras(processo.id, { mecanicoId, horas: valor, nota: nota.trim() || undefined }), {
              onSuccess: () => { toast('Horas registadas'); onFechar(); },
              onError: (e) => toast(mensagemErro(e), 'erro'),
            })}
          >
            Registar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Técnico">
          {(a) => (
            <Select {...a} value={mecanicoId} onChange={(e) => setMecanicoId(e.target.value)}>
              <option value="">Escolha…</option>
              {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nome}{t.semAcesso ? '' : ' (usa o sistema)'}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Horas trabalhadas" hint="Ex.: 1,5 para hora e meia. Contam para a eficiência da equipa nos relatórios.">
          {(a) => <Input {...a} inputMode="decimal" value={horas} onChange={(e) => setHoras(e.target.value.replace(/[^\d.,]/g, ''))} className="num w-32" autoFocus />}
        </Field>
        <Field label="O que fez" hint="Opcional">{(a) => <Input {...a} value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} placeholder="Ex.: substituição das pastilhas" />}</Field>
      </div>
    </Modal>
  );
}
