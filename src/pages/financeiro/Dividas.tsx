import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useDividas } from '../../api/hooks';
import { Card } from '../../components/ui/Card';
import StatTile from '../../components/ui/StatTile';
import Kz from '../../components/ui/Kz';
import Button from '../../components/ui/Button';
import ComporMensagem from '../../components/comunicacoes/ComporMensagem';
import { useAuth } from '../../auth/useAuth';
import type { DividaCliente } from '../../types';
import { Table, Th, Tr, Td } from '../../components/ui/Table';
import { Carregando, Vazio } from '../../components/ui/Estados';
import { formatAOA } from '../../lib/format';

const ESCALOES = ['Até 30 dias', '31–60 dias', '61–90 dias', 'Mais de 90 dias'];

/** Dívidas de clientes por antiguidade, com lembrete de pagamento por WhatsApp. */
export default function Dividas() {
  const { can } = useAuth();
  const { data: dividas, isPending } = useDividas();
  const [lembrar, setLembrar] = useState<DividaCliente | null>(null);
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
              return (
                <Tr key={d.cliente.id}>
                  <Td><Link to={`/clientes/${d.cliente.id}`} className="font-semibold text-mzd-black underline-offset-4 hover:underline">{d.cliente.nome}</Link></Td>
                  <Td>
                    {d.faturas.map((f) => (
                      <Link key={f.numero} to={`/processos/${f.processoId}`} className="num block text-xs text-mzd-gray hover:underline">{f.numero} · {f.dias} dias</Link>
                    ))}
                  </Td>
                  {d.escaloes.map((v, i) => (
                    <Td key={i} direita className={v === 0 ? 'text-mzd-gray' : i >= 2 ? 'font-semibold text-sinal-vermelho' : ''}>{v === 0 ? '—' : <Kz valor={v} />}</Td>
                  ))}
                  <Td direita><Kz valor={d.total} className="font-semibold" /></Td>
                  <Td direita>
                    {!can('mensagens.enviar') ? null : d.cliente.consentimentoMensagens ? (
                      <Button variante="secundario" tamanho="sm" icone={<MessageCircle size={13} />} title={`Mais antiga: ${maisAntiga} dias`} onClick={() => setLembrar(d)}>
                        Lembrar
                      </Button>
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
      {lembrar && (
        <ComporMensagem
          alvo={{ clienteId: lembrar.cliente.id, divida: { total: lembrar.total, faturas: lembrar.faturas.map((f) => f.numero) } }}
          modeloInicial="divida"
          onFechar={() => setLembrar(null)}
        />
      )}
    </div>
  );
}
