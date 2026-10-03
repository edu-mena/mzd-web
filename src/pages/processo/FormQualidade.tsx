import { useState } from 'react';
import clsx from 'clsx';
import { useAcaoProcesso } from '../../api/hooks';
import { api } from '../../api/endpoints';
import type { ProcessoDetalhado } from '../../types';
import { VERIFICACOES_SEGURANCA } from '../../types';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import { Field, Input, Textarea } from '../../components/ui/Form';
import { Aviso } from '../../components/ui/Controls';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';

interface Linha { item: string; grupo: 'reparacao' | 'seguranca'; conforme: boolean | null; nota: string }

/** Controlo de qualidade: itens reparados + verificações de segurança padrão. */
export default function FormQualidade({ processo, onFechar }: { processo: ProcessoDetalhado; onFechar: () => void }) {
  const toast = useToast();
  const acao = useAcaoProcesso();
  const [linhas, setLinhas] = useState<Linha[]>(() => [
    ...(processo.diagnostico?.itens ?? []).filter((i) => i.estado !== 'ok').map((i) => ({ item: i.sistema, grupo: 'reparacao' as const, conforme: null, nota: '' })),
    ...VERIFICACOES_SEGURANCA.map((v) => ({ item: v, grupo: 'seguranca' as const, conforme: null, nota: '' })),
  ]);
  const [observacoes, setObservacoes] = useState('');
  const set = (k: number, p: Partial<Linha>) => setLinhas((l) => l.map((x, i) => (i === k ? { ...x, ...p } : x)));

  const respondidas = linhas.filter((l) => l.conforme !== null).length;
  const falhas = linhas.filter((l) => l.conforme === false).length;
  const completo = respondidas === linhas.length;

  function registar() {
    acao.mutate(
      () => api.processos.registarQualidade(processo.id, {
        itens: linhas.map((l) => ({ item: l.item, conforme: l.conforme, nota: l.nota.trim() || undefined })),
        observacoes: observacoes.trim() || undefined,
      }),
      {
        onSuccess: (p) => {
          toast(p.estado === 'pronta_entrega' ? `Aprovado — fatura ${p.fatura?.numero ?? ''} emitida` : 'Reprovado — a viatura voltou à reparação');
          onFechar();
        },
        onError: (e) => toast(mensagemErro(e), 'erro'),
      }
    );
  }

  return (
    <Drawer
      open
      onClose={onFechar}
      titulo="Controlo de qualidade"
      subtitulo="Verifique cada item antes de a viatura ficar pronta para o cliente"
      rodape={
        <>
          <span className="num mr-auto text-xs text-mzd-gray">{respondidas}/{linhas.length} verificados</span>
          <Button variante="fantasma" onClick={onFechar}>Cancelar</Button>
          <Button variante={falhas ? 'perigo' : 'primario'} onClick={registar} disabled={!completo} carregando={acao.isPending}>
            {falhas ? `Reprovar (${falhas} não conforme)` : 'Aprovar e emitir fatura'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {processo.retrabalhos ? <Aviso>Esta viatura já voltou {processo.retrabalhos} vez(es) à reparação.</Aviso> : null}
        {(['reparacao', 'seguranca'] as const).map((grupo) => {
          const doGrupo = linhas.map((l, k) => ({ l, k })).filter((x) => x.l.grupo === grupo);
          if (doGrupo.length === 0) return null;
          return (
            <section key={grupo}>
              <h3 className="rotulo mb-2">{grupo === 'reparacao' ? 'Problemas reparados (do diagnóstico)' : 'Verificações de segurança'}</h3>
              <ul className="divide-y divide-linha rounded-md border border-linha bg-white">
                {doGrupo.map(({ l, k }) => (
                  <li key={l.item} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13.5px] font-medium text-mzd-black">{l.item}</span>
                      <div className="flex gap-1" role="radiogroup" aria-label={l.item}>
                        {[{ v: true, t: 'Conforme' }, { v: false, t: 'Não conforme' }].map((o) => (
                          <button
                            key={o.t}
                            type="button"
                            role="radio"
                            aria-checked={l.conforme === o.v}
                            onClick={() => set(k, { conforme: o.v })}
                            className={clsx(
                              'h-8 rounded-md border px-3 text-xs font-semibold',
                              l.conforme !== o.v && 'border-linha-forte bg-white text-mzd-gray hover:text-mzd-black',
                              l.conforme === o.v && o.v && 'border-sinal-verde bg-sinal-verde text-white',
                              l.conforme === o.v && !o.v && 'border-mzd-red bg-mzd-red text-white'
                            )}
                          >
                            {o.t}
                          </button>
                        ))}
                      </div>
                    </div>
                    {l.conforme === false && (
                      <Input value={l.nota} onChange={(e) => set(k, { nota: e.target.value })} placeholder="O que tem de ser corrigido? (obrigatório)" className="mt-2" aria-label={`Problema em ${l.item}`} />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        <Field label="Observações" hint="Opcional">{(a) => <Textarea {...a} rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />}</Field>
        {falhas > 0 && <Aviso tom="vermelho">Ao reprovar, a viatura volta à reparação com uma tarefa por cada item não conforme e conta como retrabalho.</Aviso>}
      </div>
    </Drawer>
  );
}
