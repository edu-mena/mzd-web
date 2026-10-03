import { useState } from 'react';
import clsx from 'clsx';
import { useAcaoProcesso } from '../../api/hooks';
import { api } from '../../api/endpoints';
import type { Diagnostico, EstadoItem, ItemDiagnostico, ProcessoDetalhado } from '../../types';
import { SISTEMAS_VEICULO } from '../../types';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import { Escolha, Field, Input, Textarea } from '../../components/ui/Form';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';
import Fotos from './Fotos';

const ESTADOS: { valor: EstadoItem; label: string; tom: 'ok' | 'aviso' | 'alerta' }[] = [
  { valor: 'ok', label: 'OK', tom: 'ok' },
  { valor: 'atencao', label: 'Atenção', tom: 'aviso' },
  { valor: 'critico', label: 'Crítico', tom: 'alerta' },
];

/** Diagnóstico por sistema. Pode ser guardado a meio (rascunho) e concluído quando está completo. */
export default function FormDiagnostico({ processo, onFechar }: { processo: ProcessoDetalhado; onFechar: () => void }) {
  const toast = useToast();
  const acao = useAcaoProcesso();
  const d = processo.diagnostico;
  const [itens, setItens] = useState<Partial<ItemDiagnostico>[]>(() =>
    SISTEMAS_VEICULO.map((s) => d?.itens.find((i) => i.sistema === s) ?? { sistema: s })
  );
  const [parecer, setParecer] = useState(d?.parecerGeral ?? '');
  const [recomendacao, setRecomendacao] = useState<Diagnostico['recomendacao']>(d?.recomendacao ?? 'reparar');
  const [urgencia, setUrgencia] = useState<Diagnostico['urgencia'] | undefined>(d?.urgencia);
  const [aGuardar, setAGuardar] = useState<'rascunho' | 'concluir' | null>(null);

  const avaliados = itens.filter((i) => i.estado).length;
  const setItem = (k: number, p: Partial<ItemDiagnostico>) => setItens((l) => l.map((x, i) => (i === k ? { ...x, ...p } : x)));

  function guardar(concluir: boolean) {
    if (concluir && avaliados < itens.length) {
      toast(`Avalie todos os sistemas antes de concluir (${avaliados} de ${itens.length}).`, 'erro');
      return;
    }
    setAGuardar(concluir ? 'concluir' : 'rascunho');
    acao.mutate(
      () => api.processos.guardarDiagnostico(processo.id, {
        itens: itens.filter((i): i is ItemDiagnostico => !!i.estado).map((i) => ({ ...i, observacao: i.observacao?.trim() || undefined })),
        parecerGeral: parecer,
        recomendacao,
        urgencia: urgencia ?? 'medio',
        concluir,
      }),
      {
        onSuccess: () => {
          toast(concluir ? 'Diagnóstico concluído — segue para orçamentação' : 'Rascunho do diagnóstico guardado');
          onFechar();
        },
        onError: (e) => toast(mensagemErro(e), 'erro'),
        onSettled: () => setAGuardar(null),
      }
    );
  }

  return (
    <Drawer
      open
      onClose={onFechar}
      largura="lg"
      titulo="Diagnóstico"
      subtitulo={<>Queixa: “{processo.fichaRecepcao.queixaCliente}”</>}
      rodape={
        <>
          <span className="mr-auto num text-xs text-mzd-gray">{avaliados}/{itens.length} sistemas avaliados</span>
          <Button variante="secundario" onClick={() => guardar(false)} carregando={aGuardar === 'rascunho'} disabled={!!aGuardar}>Guardar rascunho</Button>
          <Button onClick={() => guardar(true)} carregando={aGuardar === 'concluir'} disabled={!!aGuardar}>Concluir diagnóstico</Button>
        </>
      }
    >
      <div className="space-y-6">
        <section>
          <h3 className="rotulo mb-2">Inspeção por sistema</h3>
          <ul className="divide-y divide-linha rounded-md border border-linha bg-white">
            {itens.map((item, k) => (
              <li key={item.sistema} className={clsx('px-4 py-3', item.estado === 'critico' && 'bg-sinal-vermelho-fundo/40')}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13.5px] font-semibold text-mzd-black">{item.sistema}</span>
                  <div className="flex gap-1" role="radiogroup" aria-label={`Estado de ${item.sistema}`}>
                    {ESTADOS.map((o) => (
                      <button
                        key={o.valor}
                        type="button"
                        role="radio"
                        aria-checked={item.estado === o.valor}
                        onClick={() => setItem(k, { estado: o.valor })}
                        className={clsx(
                          'h-8 rounded-md border px-3 text-xs font-semibold',
                          item.estado !== o.valor && 'border-linha-forte bg-white text-mzd-gray hover:text-mzd-black',
                          item.estado === o.valor && o.tom === 'ok' && 'border-sinal-verde bg-sinal-verde text-white',
                          item.estado === o.valor && o.tom === 'aviso' && 'border-sinal-ambar bg-sinal-ambar text-white',
                          item.estado === o.valor && o.tom === 'alerta' && 'border-mzd-red bg-mzd-red text-white'
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                {item.estado && item.estado !== 'ok' && (
                  <Input
                    value={item.observacao ?? ''}
                    onChange={(e) => setItem(k, { observacao: e.target.value })}
                    placeholder="O que foi encontrado? (obrigatório)"
                    className="mt-2"
                    aria-label={`Observação sobre ${item.sistema}`}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>

        <Field label="Parecer técnico geral" hint="Explique ao cliente, em linguagem simples, o que a viatura tem e o que recomenda.">
          {(a) => <Textarea {...a} rows={4} value={parecer} onChange={(e) => setParecer(e.target.value)} />}
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Escolha
            label="Recomendação"
            valor={recomendacao}
            onChange={setRecomendacao}
            opcoes={[{ valor: 'reparar', label: 'Reparar' }, { valor: 'substituir', label: 'Substituir' }, { valor: 'ambos', label: 'Ambos' }]}
          />
          <Escolha
            label="Urgência"
            valor={urgencia}
            onChange={setUrgencia}
            opcoes={[
              { valor: 'baixo', label: 'Baixa' },
              { valor: 'medio', label: 'Média' },
              { valor: 'alto', label: 'Alta', tom: 'aviso' },
              { valor: 'seguranca', label: 'Segurança', tom: 'alerta' },
            ]}
          />
        </div>

        <section>
          <h3 className="rotulo mb-2">Fotografias e vídeos do diagnóstico</h3>
          <p className="mb-2 text-xs text-mzd-gray">Mostram ao cliente o que foi encontrado — aumentam a confiança e a aprovação do orçamento.</p>
          <Fotos processoId={processo.id} etapa="diagnostico" />
        </section>
      </div>
    </Drawer>
  );
}
