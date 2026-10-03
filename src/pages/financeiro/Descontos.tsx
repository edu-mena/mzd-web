import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAlterarFinanceiro, useConfiguracao, useProcessos, useUtilizadores } from '../../api/hooks';
import { api } from '../../api/endpoints';
import type { ProcessoDetalhado } from '../../types';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Kz from '../../components/ui/Kz';
import { Field, Textarea } from '../../components/ui/Form';
import { Table, Th, Tr, Td } from '../../components/ui/Table';
import { Carregando, Vazio } from '../../components/ui/Estados';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';
import { formatDateTime } from '../../lib/format';

/** Pedidos de desconto acima do limite, à espera da decisão da Direção. */
export default function Descontos() {
  const toast = useToast();
  const alterar = useAlterarFinanceiro<{ id: string }>();
  const { data: processos, isPending } = useProcessos();
  const { data: utilizadores = [] } = useUtilizadores();
  const { data: config } = useConfiguracao();
  const [recusar, setRecusar] = useState<ProcessoDetalhado | null>(null);
  const [motivo, setMotivo] = useState('');
  if (isPending || !processos) return <Carregando />;
  const pendentes = processos.filter((p) => p.orcamento?.desconto?.estado === 'pendente');

  const decidir = (p: ProcessoDetalhado, decisao: 'aprovado' | 'recusado', m?: string) =>
    alterar.mutate(() => api.financeiro.decidirDesconto(p.id, decisao, m), {
      onSuccess: () => { toast(`Desconto ${decisao} — ${p.numero}`); setRecusar(null); },
      onError: (e) => toast(mensagemErro(e), 'erro'),
    });

  if (pendentes.length === 0) {
    return <Card><Vazio titulo="Sem pedidos pendentes">Descontos até {config?.descontoMaximoPct ?? 5}% aplicam-se automaticamente; acima disso aparecem aqui para decisão.</Vazio></Card>;
  }

  return (
    <Card>
      <Table>
        <thead><tr><Th>Processo</Th><Th>Cliente</Th><Th direita>Orçamento</Th><Th direita>Desconto</Th><Th>Motivo</Th><Th>Pedido por</Th><Th /></tr></thead>
        <tbody>
          {pendentes.map((p) => {
            const d = p.orcamento!.desconto!;
            const bruto = [...p.orcamento!.pecas.map((l) => l.quantidade * l.precoUnitario), ...p.orcamento!.maoObra.map((l) => l.horas * l.valorHora)].reduce((s, v) => s + v, 0);
            return (
              <Tr key={p.id}>
                <Td><Link to={`/processos/${p.id}`} className="num font-semibold underline-offset-4 hover:underline">{p.numero}</Link></Td>
                <Td>{p.cliente.nome}</Td>
                <Td direita><Kz valor={bruto} className="text-mzd-gray" /><span className="block text-[11px] text-mzd-gray">sem IVA</span></Td>
                <Td direita><span className="num font-semibold">{d.percentagem}%</span><span className="block text-xs text-sinal-vermelho">−<Kz valor={Math.round(bruto * d.percentagem / 100)} /></span></Td>
                <Td className="max-w-xs text-mzd-gray">{d.motivo}</Td>
                <Td className="text-mzd-gray">{utilizadores.find((u) => u.id === d.pedidoPorId)?.nome}<span className="num block text-[11px]">{formatDateTime(d.pedidoEm)}</span></Td>
                <Td direita className="whitespace-nowrap">
                  <Button variante="fantasma" tamanho="sm" onClick={() => { setRecusar(p); setMotivo(''); }}>Recusar</Button>
                  <Button tamanho="sm" onClick={() => decidir(p, 'aprovado')} carregando={alterar.isPending}>Aprovar</Button>
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
      {recusar && (
        <Modal
          open
          onClose={() => setRecusar(null)}
          title={`Recusar desconto — ${recusar.numero}`}
          footer={
            <>
              <Button variante="fantasma" onClick={() => setRecusar(null)}>Voltar</Button>
              <Button variante="perigo" disabled={motivo.trim().length < 3} onClick={() => decidir(recusar, 'recusado', motivo)}>Recusar desconto</Button>
            </>
          }
        >
          <Field label="Motivo" hint="Aparece no histórico do processo para quem pediu">{(a) => <Textarea {...a} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />}</Field>
        </Modal>
      )}
    </Card>
  );
}
