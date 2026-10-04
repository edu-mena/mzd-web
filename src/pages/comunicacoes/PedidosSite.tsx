import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, CalendarPlus, Check, MessageCircle, Phone } from 'lucide-react';
import clsx from 'clsx';
import { usePedidosSite, useTratarPedido } from '../../api/hooks';
import { useAuth } from '../../auth/useAuth';
import type { EstadoPedido, PedidoServico } from '../../types';
import { ESTADO_PEDIDO_LABEL } from '../../types';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Segmented } from '../../components/ui/Controls';
import { Input } from '../../components/ui/Form';
import { Carregando, Vazio } from '../../components/ui/Estados';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';
import { formatDate } from '../../lib/format';
import { haQuanto } from '../../lib/datas';
import { linkWhatsApp } from '../../lib/mensagens';
import FormMarcacao from '../agenda/FormMarcacao';

const TOM: Record<EstadoPedido, string> = {
  novo: 'bg-sinal-vermelho-fundo text-sinal-vermelho',
  contactado: 'bg-sinal-ambar-fundo text-sinal-ambar',
  marcado: 'bg-sinal-verde-fundo text-sinal-verde',
  arquivado: 'bg-zinc-100 text-mzd-gray',
};

/** Pedidos feitos no site público: ligar, marcar ou arquivar. */
export default function PedidosSite() {
  const { can } = useAuth();
  const toast = useToast();
  const { data: pedidos, isPending } = usePedidosSite();
  const tratar = useTratarPedido();
  const [filtro, setFiltro] = useState<'abertos' | 'todos'>('abertos');
  const [marcar, setMarcar] = useState<PedidoServico | null>(null);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [agora] = useState(() => Date.now());
  if (isPending || !pedidos) return <Carregando />;

  const lista = pedidos.filter((p) => filtro === 'todos' || p.estado === 'novo' || p.estado === 'contactado');
  const mudar = (p: PedidoServico, estado: EstadoPedido, extra: { marcacaoId?: string } = {}, msg?: string) =>
    tratar.mutate({ id: p.id, estado, notas: notas[p.id] ?? p.notas, ...extra }, {
      onSuccess: () => msg && toast(msg),
      onError: (e) => toast(mensagemErro(e), 'erro'),
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-mzd-gray">Pedidos de orçamento feitos no site. Ligue ao cliente e, se for o caso, marque logo o dia.</p>
        <Segmented label="Mostrar" value={filtro} onChange={setFiltro} opcoes={[{ valor: 'abertos', label: 'Por tratar' }, { valor: 'todos', label: 'Todos' }]} />
      </div>
      {lista.length === 0 ? (
        <Card><Vazio titulo={filtro === 'abertos' ? 'Nenhum pedido por tratar' : 'Ainda não há pedidos'}>Os pedidos feitos em mzd.it.ao aparecem aqui.</Vazio></Card>
      ) : (
        <Card>
          <ul className="divide-y divide-linha/70">
            {lista.map((p) => (
              <li key={p.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold text-mzd-black">{p.nome}</span>
                      <span className={clsx('rotulo rounded px-1.5 py-px !text-[10px]', TOM[p.estado])}>{ESTADO_PEDIDO_LABEL[p.estado]}</span>
                      <span className={clsx('num text-xs', p.estado === 'novo' && agora - new Date(p.data).getTime() > 4 * 3600000 ? 'font-semibold text-sinal-vermelho' : 'text-mzd-gray')}>{haQuanto(p.data, agora)}</span>
                    </p>
                    <p className="mt-0.5 text-[13px] text-mzd-graphite">
                      <strong className="font-semibold">{p.servico}</strong>
                      {p.modelo && <> · {p.modelo}</>}
                      {p.matricula && <> · <span className="num">{p.matricula}</span></>}
                      {p.dataPreferida && <> · prefere {formatDate(p.dataPreferida)}</>}
                    </p>
                    {p.mensagem && <p className="mt-1 text-[13px] text-mzd-gray">“{p.mensagem}”</p>}
                    <p className="num mt-1 text-xs text-mzd-gray">{p.telefone}{p.email && ` · ${p.email}`}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <a href={`tel:${p.telefone.replace(/\s/g, '')}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-linha-forte bg-white px-2.5 text-xs font-semibold text-mzd-black hover:border-zinc-400"><Phone size={13} /> Ligar</a>
                    <a href={linkWhatsApp(p.telefone, `Olá ${p.nome.split(' ')[0]}, recebemos o seu pedido no site da MZD (${p.servico}${p.modelo ? `, ${p.modelo}` : ''}). Quando lhe dá jeito trazer a viatura?`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-linha-forte bg-white px-2.5 text-xs font-semibold text-mzd-black hover:border-zinc-400"><MessageCircle size={13} /> WhatsApp</a>
                  </div>
                </div>
                {(p.estado === 'novo' || p.estado === 'contactado') && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Input
                      aria-label={`Notas sobre o pedido de ${p.nome}`}
                      placeholder="Notas (ex.: liga na segunda)"
                      value={notas[p.id] ?? p.notas ?? ''}
                      onChange={(e) => setNotas({ ...notas, [p.id]: e.target.value })}
                      className="!h-8 min-w-0 flex-1 text-xs"
                    />
                    {p.estado === 'novo' && <Button variante="secundario" tamanho="sm" icone={<Check size={13} />} onClick={() => mudar(p, 'contactado', {}, 'Marcado como contactado')}>Contactado</Button>}
                    {can('agenda.gerir') && <Button tamanho="sm" icone={<CalendarPlus size={13} />} onClick={() => setMarcar(p)}>Marcar dia</Button>}
                    <Button variante="fantasma" tamanho="sm" icone={<Archive size={13} />} onClick={() => mudar(p, 'arquivado', {}, 'Pedido arquivado')}>Arquivar</Button>
                  </div>
                )}
                {p.estado !== 'novo' && p.estado !== 'contactado' && (p.notas || p.marcacaoId) && (
                  <p className="mt-2 text-xs text-mzd-gray">
                    {p.notas}{p.marcacaoId && <> · <Link to="/agenda" className="font-semibold text-mzd-black hover:underline">ver na agenda</Link></>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {marcar && (
        <FormMarcacao
          inicial={{
            nome: marcar.nome, telefone: marcar.telefone, matricula: marcar.matricula,
            notas: [`Pedido do site: ${marcar.servico}${marcar.modelo ? ` (${marcar.modelo})` : ''}`, marcar.mensagem].filter(Boolean).join(' — '),
          }}
          diaInicial={marcar.dataPreferida}
          onFechar={() => setMarcar(null)}
          onCriada={(m) => mudar(marcar, 'marcado', { marcacaoId: m.id })}
        />
      )}
    </div>
  );
}
