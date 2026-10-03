import { useState } from 'react';
import { useAcaoProcesso, useConfiguracao } from '../../api/hooks';
import { api } from '../../api/endpoints';
import type { ItemOrcamentoMaoObra, ItemOrcamentoPeca, ProcessoDetalhado } from '../../types';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import { Field, Input, Textarea } from '../../components/ui/Form';
import { Aviso } from '../../components/ui/Controls';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';
import EditorLinhas from './EditorLinhas';
import { useAuth } from '../../auth/useAuth';

/** Orçamento principal (feito a partir do diagnóstico). */
export function FormOrcamento({ processo, onFechar }: { processo: ProcessoDetalhado; onFechar: () => void }) {
  const toast = useToast();
  const acao = useAcaoProcesso();
  const { data: config } = useConfiguracao();
  const o = processo.orcamento;
  const [linhas, setLinhas] = useState<{ pecas: ItemOrcamentoPeca[]; maoObra: ItemOrcamentoMaoObra[] }>({ pecas: o?.pecas ?? [], maoObra: o?.maoObra ?? [] });
  const [validade, setValidade] = useState(String(o?.validadeDias ?? config?.validadeOrcamentoDias ?? 15));
  const [condicoes, setCondicoes] = useState(o?.condicoesPagamento ?? '50% na aprovação, 50% na entrega');
  const { can } = useAuth();
  const [descontoPct, setDescontoPct] = useState(String(o?.desconto && o.desconto.estado !== 'recusado' ? o.desconto.percentagem : ''));
  const [descontoMotivo, setDescontoMotivo] = useState(o?.desconto?.motivo ?? '');
  const pct = Number(descontoPct.replace(',', '.')) || 0;
  const limite = config?.descontoMaximoPct ?? 5;
  const precisaAprovacao = pct > limite && !can('financeiro.supervisionar');
  const problemas = processo.diagnostico?.itens.filter((i) => i.estado !== 'ok') ?? [];

  function guardar() {
    acao.mutate(
      () => api.processos.guardarOrcamento(processo.id, {
        ...linhas, validadeDias: Number(validade), condicoesPagamento: condicoes,
        desconto: pct > 0 ? { percentagem: pct, motivo: descontoMotivo } : undefined,
      }),
      {
        onSuccess: (p) => {
          toast(p.orcamento?.desconto?.estado === 'pendente' ? 'Orçamento guardado — desconto enviado à Direção para aprovação' : 'Orçamento guardado');
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
      largura="lg"
      titulo="Orçamento"
      subtitulo="Os valores são sem IVA; o IVA é acrescentado no total"
      rodape={
        <>
          <Button variante="fantasma" onClick={onFechar}>Cancelar</Button>
          <Button onClick={guardar} carregando={acao.isPending}>Guardar orçamento</Button>
        </>
      }
    >
      <div className="space-y-6">
        {problemas.length > 0 && (
          <Aviso tom="neutro">
            <p className="font-semibold">Encontrado no diagnóstico</p>
            <ul className="mt-1 space-y-0.5">
              {problemas.map((p) => (
                <li key={p.sistema}>
                  <span className={p.estado === 'critico' ? 'font-semibold text-sinal-vermelho' : 'font-semibold text-sinal-ambar'}>{p.sistema}</span> — {p.observacao}
                </li>
              ))}
            </ul>
          </Aviso>
        )}
        <EditorLinhas {...linhas} onChange={setLinhas} taxaIva={config?.taxaIva ?? 14} valorHora={config?.valorHora ?? 8500} descontoPct={pct} />
        <section className="rounded-md border border-linha bg-white p-4">
          <h3 className="rotulo mb-2">Desconto</h3>
          {o?.desconto?.estado === 'recusado' && (
            <Aviso tom="vermelho">O desconto de {o.desconto.percentagem}% foi recusado pela Direção{o.desconto.motivoDecisao ? `: ${o.desconto.motivoDecisao}` : ''}. Ajuste-o ou retire-o.</Aviso>
          )}
          {o?.desconto?.estado === 'pendente' && <Aviso>O desconto de {o.desconto.percentagem}% aguarda aprovação da Direção.</Aviso>}
          <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-[140px_1fr]">
            <Field label="Desconto (%)" hint={`Até ${limite}% sem aprovação`}>
              {(a) => <Input {...a} value={descontoPct} onChange={(e) => setDescontoPct(e.target.value.replace(/[^\d.,]/g, ''))} inputMode="decimal" className="num" placeholder="0" />}
            </Field>
            <Field label="Motivo" hint={pct > 0 ? 'Obrigatório — fica no histórico' : 'Só se houver desconto'}>
              {(a) => <Input {...a} value={descontoMotivo} onChange={(e) => setDescontoMotivo(e.target.value)} disabled={pct === 0} placeholder="Ex.: cliente frotista, campanha de revisões" />}
            </Field>
          </div>
          {precisaAprovacao && <p className="mt-2 text-xs font-semibold text-sinal-ambar">Acima de {limite}%: o orçamento só segue para o cliente depois de a Direção aprovar o desconto.</p>}
        </section>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[140px_1fr]">
          <Field label="Validade (dias)">{(a) => <Input {...a} value={validade} onChange={(e) => setValidade(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="num" />}</Field>
          <Field label="Condições de pagamento">{(a) => <Input {...a} value={condicoes} onChange={(e) => setCondicoes(e.target.value)} />}</Field>
        </div>
      </div>
    </Drawer>
  );
}

/** Trabalho adicional descoberto durante a reparação (precisa de nova aprovação do cliente). */
export function FormAdicional({ processo, onFechar }: { processo: ProcessoDetalhado; onFechar: () => void }) {
  const toast = useToast();
  const acao = useAcaoProcesso();
  const { data: config } = useConfiguracao();
  const [linhas, setLinhas] = useState<{ pecas: ItemOrcamentoPeca[]; maoObra: ItemOrcamentoMaoObra[] }>({ pecas: [], maoObra: [] });
  const [justificacao, setJustificacao] = useState('');

  function enviar() {
    acao.mutate(() => api.processos.proporAdicional(processo.id, { ...linhas, justificacao }), {
      onSuccess: () => {
        toast('Trabalho adicional registado — aguarda decisão do cliente');
        onFechar();
      },
      onError: (e) => toast(mensagemErro(e), 'erro'),
    });
  }

  return (
    <Drawer
      open
      onClose={onFechar}
      largura="lg"
      titulo="Trabalho adicional"
      subtitulo="Algo encontrado durante a reparação que não estava no orçamento aprovado"
      rodape={
        <>
          <Button variante="fantasma" onClick={onFechar}>Cancelar</Button>
          <Button onClick={enviar} carregando={acao.isPending}>Registar e pedir aprovação</Button>
        </>
      }
    >
      <div className="space-y-6">
        <Field label="O que foi encontrado e porque é necessário" hint="Este texto é mostrado ao cliente.">
          {(a) => <Textarea {...a} rows={3} value={justificacao} onChange={(e) => setJustificacao(e.target.value)} autoFocus />}
        </Field>
        <EditorLinhas {...linhas} onChange={setLinhas} taxaIva={config?.taxaIva ?? 14} valorHora={config?.valorHora ?? 8500} />
        <p className="text-xs text-mzd-gray">O trabalho só é feito depois de o cliente aprovar. Se recusar, a reparação continua apenas com o que foi aprovado.</p>
      </div>
    </Drawer>
  );
}
