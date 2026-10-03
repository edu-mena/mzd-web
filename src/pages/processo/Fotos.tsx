import { useState } from 'react';
import { useAnexos, useEnviarAnexo } from '../../api/hooks';
import type { Anexo, EstadoProcesso } from '../../types';
import { ESTADO_LABEL } from '../../types';
import { MiniaturaAnexo, SeletorFicheiros, VisualizadorAnexo } from '../../components/ui/Anexos';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';

/**
 * Fotografias e vídeos de um processo. Com `etapa`, mostra só os dessa etapa e envia novos para ela;
 * sem `etapa`, mostra todos agrupados por etapa (separador "Fotos").
 */
export default function Fotos({ processoId, etapa, podeEnviar = true }: { processoId: string; etapa?: EstadoProcesso; podeEnviar?: boolean }) {
  const toast = useToast();
  const { data: anexos = [], isPending } = useAnexos(processoId);
  const enviar = useEnviarAnexo(processoId);
  const [aEnviar, setAEnviar] = useState(0);
  const [aberto, setAberto] = useState<Anexo | null>(null);

  const visiveis = anexos.filter((a) => a.tipo !== 'assinatura' && (!etapa || a.etapa === etapa));
  const grupos = etapa
    ? [{ etapa, itens: visiveis }]
    : [...new Set(visiveis.map((a) => a.etapa))].map((e) => ({ etapa: e, itens: visiveis.filter((a) => a.etapa === e) }));

  return (
    <div className="space-y-4">
      {grupos.map((g) => (
        <div key={g.etapa}>
          {!etapa && <p className="rotulo mb-2">{ESTADO_LABEL[g.etapa]}</p>}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
            {g.itens.map((a) => <MiniaturaAnexo key={a.id} anexo={a} onAbrir={() => setAberto(a)} />)}
          </div>
        </div>
      ))}
      {!isPending && visiveis.length === 0 && !podeEnviar && <p className="text-sm text-mzd-gray">Ainda não há fotografias.</p>}
      {podeEnviar && (
        <SeletorFicheiros
          ocupado={aEnviar > 0}
          onEscolher={async (ficheiros, erros) => {
            erros.forEach((m) => toast(m, 'erro'));
            setAEnviar(ficheiros.length);
            for (const f of ficheiros) {
              try {
                await enviar.mutateAsync({ ficheiro: f.ficheiro, tipo: f.tipo, nome: f.nome, legenda: etapa ? ESTADO_LABEL[etapa] : undefined });
              } catch (e) {
                toast(mensagemErro(e), 'erro');
              } finally {
                URL.revokeObjectURL(f.previsualizacao);
                setAEnviar((n) => n - 1);
              }
            }
          }}
        />
      )}
      <VisualizadorAnexo anexo={aberto} onFechar={() => setAberto(null)} />
    </div>
  );
}
