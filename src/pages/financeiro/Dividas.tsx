import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useDividas } from '../../api/hooks';
import { Card } from '../../components/ui/Card';
import StatTile from '../../components/ui/StatTile';
import Kz from '../../components/ui/Kz';
import { botao } from '../../components/ui/botao';
import { Table, Th, Tr, Td } from '../../components/ui/Table';
import { Carregando, Vazio } from '../../components/ui/Estados';
import { formatAOA } from '../../lib/format';
import { linkWhatsApp } from '../../lib/mensagens';

const ESCALOES = ['Até 30 dias', '31–60 dias', '61–90 dias', 'Mais de 90 dias'];

/** Dívidas de clientes por antiguidade, com lembrete de pagamento por WhatsApp. */
export default function Dividas() {
  const { data: dividas, isPending } = useDividas();
  if (isPending || !dividas) return <Carregando />;
  const total = dividas.reduce((s, d) => s + d.total, 0);
  const porEscalao = [0, 1, 2, 3].map((i) => dividas.reduce((s, d) => s + d.escaloes[i], 0));

  if (dividas.length === 0) return <Card><Vazio titulo="Sem dívidas">Todas as faturas emitidas estão pagas.</Vazio></Card>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Total por receber" value={formatAOA(total)} hint={`${dividas.length} cliente(s)`} tom="alerta" />
        {ESCALOES.map((e, i) => (
          <StatTile key={e} label={e} value={formatAOA(porEscalao[i])} tom={i >= 2 && porEscalao[i] > 0 ? 'alerta' : i === 1 && porEscalao[i] > 0 ? 'aviso' : 'neutro'} />
        ))}
      </div>
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Faturas em aberto</Th>
              {ESCALOES.map((e) => <Th key={e} direita>{e}</Th>)}
              <Th direita>Total</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {dividas.map((d) => {
              const maisAntiga = Math.max(...d.faturas.map((f) => f.dias));
              const mensagem = `Olá ${d.cliente.nome.split(' ')[0]}, lembramos que tem ${formatAOA(d.total)} por liquidar na MZD Carros e Motores (${d.faturas.map((f) => f.numero).join(', ')}). Pode pagar por transferência, TPA ou Multicaixa. Obrigado.`;
              return (
                <Tr key={d.cliente.id}>
                  <Td><Link to={`/clientes/${d.cliente.id}`} className="font-semibold text-mzd-black underline-offset-4 hover:underline">{d.cliente.nome}</Link></Td>
                  <Td>
                    {d.faturas.map((f) => (
                      <Link key={f.numero} to={`/processos/${f.processoId}`} className="num block text-xs text-mzd-gray hover:underline">{f.numero} · {f.dias} dias</Link>
                    ))}
                  </Td>
                  {d.escaloes.map((v, i) => (
                    <Td key={i} direita className={v === 0 ? 'text-zinc-300' : i >= 2 ? 'font-semibold text-sinal-vermelho' : ''}>{v === 0 ? '—' : <Kz valor={v} />}</Td>
                  ))}
                  <Td direita><Kz valor={d.total} className="font-semibold" /></Td>
                  <Td direita>
                    {d.cliente.consentimentoMensagens ? (
                      <a href={linkWhatsApp(d.cliente.telefone, mensagem)} target="_blank" rel="noopener noreferrer" className={botao('secundario', 'sm')} title={`Mais antiga: ${maisAntiga} dias`}>
                        <MessageCircle size={13} /> Lembrar
                      </a>
                    ) : (
                      <span className="text-[11px] text-mzd-gray">Sem consentimento</span>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
