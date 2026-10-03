import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CornerDownRight, Mail, MessageCircle } from 'lucide-react';
import clsx from 'clsx';
import { useModelos, useUtilizadores } from '../../api/hooks';
import type { EstadoMensagem, Mensagem } from '../../types';
import { CANAL_LABEL, ESTADO_MENSAGEM_LABEL } from '../../types';
import { formatDateTime } from '../../lib/format';

const TOM_ESTADO: Record<EstadoMensagem, string> = {
  registada: 'bg-zinc-100 text-mzd-gray',
  enviada: 'bg-zinc-100 text-mzd-black',
  entregue: 'bg-sinal-verde-fundo text-sinal-verde',
  lida: 'bg-sinal-verde-fundo text-sinal-verde',
  falhou: 'bg-sinal-vermelho-fundo text-sinal-vermelho',
  recebida: 'bg-sinal-ambar-fundo text-sinal-ambar',
};

/** Registo de mensagens, da mais recente para a mais antiga. As respostas do cliente ficam recuadas. */
export default function ListaMensagens({ mensagens, mostrarCliente = false }: { mensagens: Mensagem[]; mostrarCliente?: boolean }) {
  const { data: utilizadores = [] } = useUtilizadores();
  const { data: modelos = [] } = useModelos();
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const alternar = (id: string) => setAbertas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <ul className="divide-y divide-linha/70">
      {mensagens.map((m) => {
        const entrada = m.direcao === 'entrada';
        const autor = utilizadores.find((u) => u.id === m.autorId)?.nome;
        const modelo = modelos.find((x) => x.chave === m.modelo)?.nome;
        const aberta = abertas.has(m.id);
        const longa = m.texto.length > 220 || m.texto.split('\n').length > 4;
        const Icone = m.canal === 'email' ? Mail : MessageCircle;
        return (
          <li key={m.id} className={clsx('px-5 py-3.5', entrada && 'bg-zinc-50/70')}>
            <div className={clsx('flex gap-3', entrada && 'pl-6')}>
              <span className={clsx('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border', entrada ? 'border-sinal-ambar/40 text-sinal-ambar' : 'border-linha-forte text-mzd-black')}>
                {entrada ? <CornerDownRight size={13} /> : <Icone size={13} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-[13px] font-semibold text-mzd-black">
                    {entrada ? `Resposta de ${m.nome.split(' ')[0]}` : mostrarCliente ? m.nome : modelo ?? 'Mensagem'}
                  </span>
                  {mostrarCliente && !entrada && modelo && <span className="text-xs text-mzd-gray">{modelo}</span>}
                  <span className="text-xs text-mzd-gray">{CANAL_LABEL[m.canal]}{m.assunto ? ` · ${m.assunto}` : ''}</span>
                  <span className={clsx('rotulo ml-auto rounded px-1.5 py-px !text-[10px]', TOM_ESTADO[m.estado])}>{ESTADO_MENSAGEM_LABEL[m.estado]}</span>
                </div>
                <p className={clsx('mt-1 whitespace-pre-line text-[13px] leading-relaxed text-mzd-graphite', !aberta && longa && 'line-clamp-3')}>{m.texto}</p>
                {longa && (
                  <button type="button" onClick={() => alternar(m.id)} className="mt-0.5 text-xs font-semibold text-mzd-black underline-offset-4 hover:underline">
                    {aberta ? 'Mostrar menos' : 'Ver mensagem completa'}
                  </button>
                )}
                {m.erro && <p className="mt-1 text-xs text-sinal-vermelho">{m.erro}</p>}
                <p className="num mt-1 text-[11.5px] text-mzd-gray">
                  {formatDateTime(m.data)}
                  {autor && <> · {entrada ? 'registada por' : 'por'} {autor}</>}
                  {mostrarCliente && m.processoId && <> · <Link to={`/processos/${m.processoId}`} className="hover:underline">processo</Link></>}
                  {mostrarCliente && m.clienteId && <> · <Link to={`/clientes/${m.clienteId}`} className="hover:underline">cliente</Link></>}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
