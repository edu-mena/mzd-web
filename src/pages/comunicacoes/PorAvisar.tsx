import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Phone } from 'lucide-react';
import clsx from 'clsx';
import type { ComunicacaoPendente } from '../../types';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Matricula from '../../components/ui/Matricula';
import { Vazio } from '../../components/ui/Estados';
import ComporMensagem from '../../components/comunicacoes/ComporMensagem';
import { haQuanto } from '../../lib/datas';

/** Ordem de urgência: o que bloqueia a oficina ou o cliente primeiro. */
const GRUPOS: { motivo: ComunicacaoPendente['motivo']; titulo: string; descricao: string; limiteHoras: number }[] = [
  { motivo: 'orcamento', titulo: 'Orçamentos por enviar', descricao: 'A reparação só começa depois da resposta do cliente.', limiteHoras: 4 },
  { motivo: 'pagamento', titulo: 'Pagamentos da aceitação em falta', descricao: 'O cliente aceitou, mas a reparação só começa depois do pagamento.', limiteHoras: 4 },
  { motivo: 'adicional', titulo: 'Trabalho adicional por aprovar', descricao: 'A viatura pode estar parada à espera da decisão.', limiteHoras: 2 },
  { motivo: 'pronta', titulo: 'Viaturas prontas por avisar', descricao: 'O prazo para levantar (e o parqueamento depois dele) só conta a partir do aviso.', limiteHoras: 4 },
  { motivo: 'rececao', titulo: 'Receções por confirmar', descricao: 'Confirmação com número de processo e prazo.', limiteHoras: 12 },
  { motivo: 'marcacao', titulo: 'Marcações por lembrar', descricao: 'Marcações até ao próximo dia útil ainda não confirmadas.', limiteHoras: 999 },
  { motivo: 'divida', titulo: 'Pagamentos em atraso', descricao: 'Faturas com mais de 30 dias, sem lembrete na última semana.', limiteHoras: 999 },
];

export default function PorAvisar({ pendentes }: { pendentes: ComunicacaoPendente[] }) {
  const [agora] = useState(() => Date.now());
  const [aberta, setAberta] = useState<ComunicacaoPendente | null>(null);

  if (pendentes.length === 0) {
    return <Card><Vazio titulo="Ninguém por avisar">Todos os clientes foram informados nos momentos importantes.</Vazio></Card>;
  }

  return (
    <div className="space-y-5">
      {GRUPOS.map((g) => {
        const itens = pendentes.filter((p) => p.motivo === g.motivo);
        if (itens.length === 0) return null;
        return (
          <section key={g.motivo}>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-[15px] font-extrabold text-mzd-black">{g.titulo}</h2>
              <span className="num text-xs font-semibold text-mzd-gray">{itens.length}</span>
              <p className="w-full text-xs text-mzd-gray sm:w-auto">{g.descricao}</p>
            </div>
            <Card>
              <ul className="divide-y divide-linha/70">
                {itens.map((p) => {
                  const atrasado = agora - new Date(p.desde).getTime() > g.limiteHoras * 3600000;
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-semibold text-mzd-black">
                          {p.clienteId ? <Link to={`/clientes/${p.clienteId}`} className="underline-offset-4 hover:underline">{p.nome}</Link> : p.nome}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-mzd-gray">
                          {p.matricula && <Matricula valor={p.matricula} tamanho="sm" />}
                          <span>{p.titulo}</span>
                          {p.processoId && <Link to={`/processos/${p.processoId}`} className="hover:underline">ver processo</Link>}
                        </p>
                      </div>
                      <span className={clsx('num text-xs', atrasado ? 'font-semibold text-sinal-vermelho' : 'text-mzd-gray')}>{haQuanto(p.desde, agora)}</span>
                      {p.consentimento ? (
                        <Button tamanho="sm" variante="secundario" icone={<MessageCircle size={13} />} onClick={() => setAberta(p)}>Preparar mensagem</Button>
                      ) : (
                        <a href={`tel:${p.telefone.replace(/\s/g, '')}`} className="flex items-center gap-1.5 text-xs text-mzd-gray hover:text-mzd-black" title="O cliente não autorizou mensagens">
                          <Phone size={13} /> <span className="num">{p.telefone}</span> · sem consentimento
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        );
      })}
      {aberta && (
        <ComporMensagem
          alvo={{ clienteId: aberta.clienteId, processoId: aberta.processoId, marcacaoId: aberta.marcacaoId, divida: aberta.divida }}
          modeloInicial={aberta.modelo}
          onFechar={() => setAberta(null)}
        />
      )}
    </div>
  );
}
