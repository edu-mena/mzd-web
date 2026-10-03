import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Lock, LockOpen, Receipt } from 'lucide-react';
import clsx from 'clsx';
import { useAlterarFinanceiro, useCaixa, useFechos, useUtilizadores } from '../../api/hooks';
import { api } from '../../api/endpoints';
import type { PagamentoCaixa } from '../../api/endpoints';
import { useAuth } from '../../auth/useAuth';
import type { FormaPagamento } from '../../types';
import { FORMA_PAGAMENTO_LABEL } from '../../types';
import { Card, CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatTile from '../../components/ui/StatTile';
import Modal from '../../components/ui/Modal';
import Kz from '../../components/ui/Kz';
import { Aviso } from '../../components/ui/Controls';
import { Field, Input, Textarea } from '../../components/ui/Form';
import { Table, Th, Tr, Td, LinhaVazia } from '../../components/ui/Table';
import { Carregando } from '../../components/ui/Estados';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';
import { formatAOA, formatDate, formatDateTime } from '../../lib/format';
import { diaISO, horaCurta, somarDias } from '../../lib/datas';
import ReciboDoc from '../../documents/ReciboDoc';

const FORMAS = Object.keys(FORMA_PAGAMENTO_LABEL) as FormaPagamento[];

/** Caixa diária: recebimentos por forma de pagamento, anulações e fecho com conferência do numerário. */
export default function Caixa() {
  const { can } = useAuth();
  const toast = useToast();
  const alterar = useAlterarFinanceiro<unknown>();
  const [dia, setDia] = useState(() => diaISO(new Date()));
  const { data: caixa, isPending } = useCaixa(dia);
  const { data: fechos = [] } = useFechos();
  const { data: utilizadores = [] } = useUtilizadores();
  const [contado, setContado] = useState('');
  const [notas, setNotas] = useState('');
  // Guarda-se só o id: o conteúdo vem sempre dos dados mais recentes (ex.: recibo acabado de anular).
  const [reciboId, setReciboId] = useState<string | null>(null);
  const [anularId, setAnularId] = useState<string | null>(null);
  const [reabrir, setReabrir] = useState(false);
  const [motivo, setMotivo] = useState('');
  const hoje = diaISO(new Date());
  const nome = (id: string) => utilizadores.find((u) => u.id === id)?.nome ?? '—';

  if (isPending || !caixa) return <Carregando />;
  const total = FORMAS.reduce((s, f) => s + caixa.totais[f], 0);
  const recibo: PagamentoCaixa | undefined = caixa.pagamentos.find((p) => p.id === reciboId);
  const anular: PagamentoCaixa | undefined = caixa.pagamentos.find((p) => p.id === anularId);
  const validos = caixa.pagamentos.filter((p) => !p.anulado);
  const diferenca = contado === '' ? null : Math.round((Number(contado) - caixa.totais.numerario) * 100) / 100;
  const podeFechar = can('pagamentos.registar') && !caixa.fecho && dia <= hoje;
  const mudarDia = (n: number) => { setDia(diaISO(somarDias(new Date(`${dia}T12:00:00`), n))); setContado(''); setNotas(''); };

  const correr = (fn: () => Promise<unknown>, msg: string, depois?: () => void) =>
    alterar.mutate(fn, { onSuccess: () => { toast(msg); depois?.(); }, onError: (e) => toast(mensagemErro(e), 'erro') });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button variante="secundario" tamanho="sm" onClick={() => mudarDia(-1)} aria-label="Dia anterior"><ChevronLeft size={15} /></Button>
          <Input type="date" value={dia} max={hoje} onChange={(e) => e.target.value && setDia(e.target.value)} className="num h-8 w-40" aria-label="Dia da caixa" />
          <Button variante="secundario" tamanho="sm" onClick={() => mudarDia(1)} disabled={dia >= hoje} aria-label="Dia seguinte"><ChevronRight size={15} /></Button>
          {dia !== hoje && <Button variante="fantasma" tamanho="sm" onClick={() => setDia(hoje)}>Hoje</Button>}
        </div>
        <span className={clsx('rotulo flex items-center gap-1.5', caixa.fecho ? '!text-mzd-black' : '!text-sinal-verde')}>
          {caixa.fecho ? <Lock size={13} /> : <LockOpen size={13} />} {caixa.fecho ? 'Caixa fechada' : 'Caixa aberta'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Total do dia" value={formatAOA(total)} hint={`${validos.length} recibo(s)`} />
        {FORMAS.map((f) => <StatTile key={f} label={FORMA_PAGAMENTO_LABEL[f]} value={formatAOA(caixa.totais[f])} />)}
      </div>

      <Card>
        <CardHeader title="Recebimentos" subtitle={formatDate(`${dia}T12:00:00`)} />
        <Table>
          <thead><tr><Th>Hora</Th><Th>Recibo</Th><Th>Cliente</Th><Th>Processo</Th><Th>Forma</Th><Th direita>Valor</Th><Th /></tr></thead>
          <tbody>
            {caixa.pagamentos.map((p) => {
              const podeAnular = !p.anulado && !caixa.fecho && can('pagamentos.registar') && p.processoEstado !== 'entregue' && (dia === hoje || can('financeiro.supervisionar'));
              return (
                <Tr key={p.id} className={p.anulado ? 'opacity-60' : ''}>
                  <Td num className="text-mzd-gray">{horaCurta(p.data)}</Td>
                  <Td num className={p.anulado ? 'line-through' : 'font-semibold'}>{p.numeroRecibo}</Td>
                  <Td>{p.cliente}</Td>
                  <Td><Link to={`/processos/${p.processoId}`} className="num underline-offset-4 hover:underline">{p.processoNumero}</Link></Td>
                  <Td className="text-mzd-gray">{FORMA_PAGAMENTO_LABEL[p.forma]}{p.referencia ? <span className="num block text-[11px]">{p.referencia}</span> : null}</Td>
                  <Td direita>
                    <Kz valor={p.valor} className={p.anulado ? 'line-through' : 'font-semibold'} />
                    {p.anulado && <span className="rotulo block !text-sinal-vermelho">Anulado</span>}
                  </Td>
                  <Td direita className="whitespace-nowrap">
                    <Button variante="fantasma" tamanho="sm" icone={<Receipt size={13} />} onClick={() => setReciboId(p.id)}>Recibo</Button>
                    {podeAnular && <Button variante="fantasma" tamanho="sm" onClick={() => { setAnularId(p.id); setMotivo(''); }}>Anular</Button>}
                  </Td>
                </Tr>
              );
            })}
            {caixa.pagamentos.length === 0 && <LinhaVazia colunas={7}>Sem recebimentos neste dia.</LinhaVazia>}
          </tbody>
        </Table>
      </Card>

      {caixa.fecho ? (
        <Card>
          <CardHeader
            title="Fecho de caixa"
            subtitle={`Fechada por ${nome(caixa.fecho.fechadoPorId)} em ${formatDateTime(caixa.fecho.fechadoEm)}`}
            action={can('financeiro.supervisionar') && <Button variante="secundario" tamanho="sm" onClick={() => { setReabrir(true); setMotivo(''); }}>Reabrir caixa</Button>}
          />
          <dl className="grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-4">
            <div><dt className="rotulo">Numerário registado</dt><dd className="mt-1 font-semibold"><Kz valor={caixa.fecho.totais.numerario} /></dd></div>
            <div><dt className="rotulo">Numerário contado</dt><dd className="mt-1 font-semibold"><Kz valor={caixa.fecho.numerarioContado} /></dd></div>
            <div>
              <dt className="rotulo">Diferença</dt>
              <dd className={clsx('mt-1 font-semibold', caixa.fecho.diferenca < 0 ? 'text-sinal-vermelho' : caixa.fecho.diferenca > 0 ? 'text-sinal-ambar' : 'text-sinal-verde')}>
                {caixa.fecho.diferenca === 0 ? 'Certo' : <Kz valor={caixa.fecho.diferenca} />}
              </dd>
            </div>
            <div><dt className="rotulo">Recibos</dt><dd className="num mt-1 font-semibold">{caixa.fecho.nRecibos}</dd></div>
            {caixa.fecho.notas && <div className="col-span-full"><dt className="rotulo">Notas</dt><dd className="text-sm">{caixa.fecho.notas}</dd></div>}
          </dl>
        </Card>
      ) : podeFechar ? (
        <Card>
          <CardHeader title="Fechar a caixa" subtitle="Conte o dinheiro na gaveta. Depois de fechada, não se registam nem anulam pagamentos neste dia." />
          <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-[200px_1fr_auto] sm:items-start">
            <Field label="Numerário contado (Kz)" hint={`Registado: ${formatAOA(caixa.totais.numerario)}`}>
              {(a) => <Input {...a} value={contado} onChange={(e) => setContado(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className="num text-base" />}
            </Field>
            <Field label="Notas" hint={diferenca ? 'Obrigatório quando há diferença' : 'Opcional'}>
              {(a) => <Textarea {...a} rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />}
            </Field>
            <div className="pt-5">
              <Button
                icone={<Lock size={15} />}
                disabled={contado === '' || (!!diferenca && notas.trim().length < 5)}
                carregando={alterar.isPending}
                onClick={() => correr(() => api.financeiro.fecharCaixa(dia, Number(contado), notas.trim() || undefined), 'Caixa fechada', () => { setContado(''); setNotas(''); })}
              >
                Fechar caixa
              </Button>
            </div>
            {diferenca !== null && (
              <div className="sm:col-span-3">
                {diferenca === 0
                  ? <Aviso tom="neutro">Numerário certo.</Aviso>
                  : <Aviso tom={diferenca < 0 ? 'vermelho' : 'ambar'}>{diferenca < 0 ? 'Falta' : 'Sobra'} <strong><Kz valor={Math.abs(diferenca)} /></strong> na gaveta. Explique nas notas.</Aviso>}
              </div>
            )}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Fechos anteriores" />
        <Table>
          <thead><tr><Th>Dia</Th><Th direita>Total</Th><Th direita>Numerário</Th><Th direita>Diferença</Th><Th>Fechado por</Th></tr></thead>
          <tbody>
            {fechos.slice(0, 10).map((f) => (
              <Tr key={f.id} className="cursor-pointer" onClick={() => setDia(f.dia)}>
                <Td num>{formatDate(`${f.dia}T12:00:00`)}</Td>
                <Td direita><Kz valor={FORMAS.reduce((s, x) => s + f.totais[x], 0)} /></Td>
                <Td direita><Kz valor={f.totais.numerario} className="text-mzd-gray" /></Td>
                <Td direita className={f.diferenca < 0 ? 'font-semibold text-sinal-vermelho' : f.diferenca > 0 ? 'text-sinal-ambar' : 'text-mzd-gray'}>{f.diferenca === 0 ? '—' : <Kz valor={f.diferenca} />}</Td>
                <Td className="text-mzd-gray">{nome(f.fechadoPorId)}</Td>
              </Tr>
            ))}
            {fechos.length === 0 && <LinhaVazia colunas={5}>Ainda não há fechos.</LinhaVazia>}
          </tbody>
        </Table>
      </Card>

      {recibo && (
        <Modal open wide onClose={() => setReciboId(null)} title={`Recibo ${recibo.numeroRecibo}`}>
          <ReciboDoc
            pagamento={recibo}
            cliente={{ nome: recibo.cliente, nif: recibo.clienteNif }}
            processoNumero={recibo.processoNumero}
            matricula={recibo.matricula}
            faturaNumero={recibo.faturaNumero}
          />
        </Modal>
      )}
      {anular && (
        <Modal
          open
          onClose={() => setAnularId(null)}
          title={`Anular recibo ${anular.numeroRecibo}`}
          footer={
            <>
              <Button variante="fantasma" onClick={() => setAnularId(null)}>Voltar</Button>
              <Button variante="perigo" disabled={motivo.trim().length < 5} carregando={alterar.isPending}
                onClick={() => correr(() => api.financeiro.anularPagamento(anular.processoId, anular.id, motivo), `Recibo ${anular.numeroRecibo} anulado`, () => setAnularId(null))}>
                Anular pagamento
              </Button>
            </>
          }
        >
          <p className="mb-3 text-sm">O pagamento de <Kz valor={anular.valor} className="font-semibold" /> ({FORMA_PAGAMENTO_LABEL[anular.forma]}) de {anular.cliente} fica anulado mas não é apagado — o recibo passa a mostrar "ANULADO".</p>
          <Field label="Motivo">{(a) => <Textarea {...a} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus placeholder="Ex.: valor registado em duplicado" />}</Field>
        </Modal>
      )}
      {reabrir && (
        <Modal
          open
          onClose={() => setReabrir(false)}
          title="Reabrir caixa"
          footer={
            <>
              <Button variante="fantasma" onClick={() => setReabrir(false)}>Voltar</Button>
              <Button disabled={motivo.trim().length < 5} carregando={alterar.isPending}
                onClick={() => correr(() => api.financeiro.reabrirCaixa(dia, motivo), 'Caixa reaberta', () => setReabrir(false))}>
                Reabrir
              </Button>
            </>
          }
        >
          <Field label="Motivo da reabertura" hint="Fica registado na auditoria">{(a) => <Textarea {...a} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />}</Field>
        </Modal>
      )}
    </div>
  );
}
