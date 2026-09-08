import { utilizadores, processos } from '../data/mock';
import { Card } from '../components/ui/Card';
import { PERFIL_LABEL } from '../types';

export default function Equipa() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-mzd-black">Equipa</h1>
        <p className="text-sm text-mzd-gray">{utilizadores.length} colaboradores</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {utilizadores.map((u) => {
          const emCurso = processos.filter((p) => p.mecanicoId === u.id && p.estado !== 'entregue').length;
          return (
            <Card key={u.id} className="p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-mzd-black text-sm font-bold text-white">{u.avatarIniciais}</span>
                <div>
                  <p className="font-bold text-mzd-black">{u.nome}</p>
                  <p className="text-xs text-mzd-gray">{PERFIL_LABEL[u.perfil]}</p>
                </div>
                <span className={`ml-auto h-2 w-2 rounded-full ${u.ativo ? 'bg-emerald-500' : 'bg-zinc-300'}`} title={u.ativo ? 'Ativo' : 'Inativo'} />
              </div>
              {u.perfil === 'mecanico' && (
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-zinc-100 pt-3 text-center">
                  <div>
                    <p className="text-sm font-extrabold text-mzd-black">{u.osConcluidas}</p>
                    <p className="text-[10px] text-mzd-gray">OS concluídas</p>
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-mzd-black">{u.tempoMedioHoras}h</p>
                    <p className="text-[10px] text-mzd-gray">Tempo médio</p>
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-mzd-red">{emCurso}</p>
                    <p className="text-[10px] text-mzd-gray">Em curso</p>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
