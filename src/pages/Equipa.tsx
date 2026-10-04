import { Link } from 'react-router-dom';
import { useProcessos, useUtilizadores } from '../api/hooks';
import { useAuth } from '../auth/useAuth';
import { botao } from '../components/ui/botao';
import { Card } from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import { Carregando, ErroCarregamento } from '../components/ui/Estados';
import { PERFIL_LABEL, estaAtivo } from '../types';
import type { Perfil } from '../types';

const ORDEM: Perfil[] = ['direcao', 'chefe_oficina', 'mecanico', 'rececionista', 'administrativa', 'admin'];

export default function Equipa() {
  const { can } = useAuth();
  const { data: utilizadores, isPending, error, refetch } = useUtilizadores();
  const { data: processos = [] } = useProcessos();
  if (isPending) return <Carregando />;
  if (error) return <ErroCarregamento erro={error} onRepetir={refetch} />;

  const ordenados = [...utilizadores].sort((a, b) => ORDEM.indexOf(a.perfil) - ORDEM.indexOf(b.perfil));

  return (
    <div className="pagina space-y-5">
      <PageHeader
        titulo="Equipa"
        descricao={`${utilizadores.filter((u) => u.ativo).length} colaboradores ativos`}
        acoes={can('utilizadores.gerir') && <Link to="/administracao" className={botao('secundario')}>Gerir contas</Link>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ordenados.map((u) => {
          const emCurso = processos.filter((p) => p.mecanicoId === u.id && estaAtivo(p.estado)).length;
          return (
            <Card key={u.id} className="p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mzd-black font-display text-sm font-bold text-white">{u.avatarIniciais}</span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-mzd-black">{u.nome}</p>
                  <p className="rotulo mt-0.5">{PERFIL_LABEL[u.perfil]}</p>
                </div>
                <span className={`ml-auto h-2 w-2 shrink-0 rounded-full ${u.ativo ? 'bg-sinal-verde' : 'bg-zinc-300'}`} title={u.ativo ? 'Ativo' : 'Inativo'} />
              </div>
              {u.perfil === 'mecanico' && (
                <dl className="mt-4 grid grid-cols-3 divide-x divide-linha border-t border-linha pt-3 text-center">
                  <div>
                    <dd className="num text-base font-semibold text-mzd-black">{u.osConcluidas ?? 0}</dd>
                    <dt className="text-[11px] text-mzd-gray">concluídas</dt>
                  </div>
                  <div>
                    <dd className="num text-base font-semibold text-mzd-black">{u.tempoMedioHoras?.toLocaleString('pt-PT') ?? '—'} h</dd>
                    <dt className="text-[11px] text-mzd-gray">tempo médio</dt>
                  </div>
                  <div>
                    <dd className="num text-base font-semibold text-mzd-black">{emCurso}</dd>
                    <dt className="text-[11px] text-mzd-gray">em curso</dt>
                  </div>
                </dl>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
