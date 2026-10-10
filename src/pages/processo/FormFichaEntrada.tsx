import { useState } from 'react';
import { useAcaoProcesso } from '../../api/hooks';
import { api } from '../../api/endpoints';
import type { ProcessoDetalhado } from '../../types';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import { Aviso } from '../../components/ui/Controls';
import { Escolha, Field, Input } from '../../components/ui/Form';
import { MiniaturaPendente, SeletorFicheiros } from '../../components/ui/Anexos';
import type { FicheiroPendente } from '../../components/ui/Anexos';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';

const COMBUSTIVEL = [
  { valor: '10', label: 'Reserva' },
  { valor: '25', label: '¼' },
  { valor: '50', label: '½' },
  { valor: '75', label: '¾' },
  { valor: '100', label: 'Cheio' },
];

/**
 * Ficha de entrada em papel, já preenchida pelo mecânico com o cliente e assinada: a receção digitaliza-a
 * (fotografia de cada página ou PDF) e transcreve o que o sistema precisa.
 */
export default function FormFichaEntrada({ processo, onFechar }: { processo: ProcessoDetalhado; onFechar: () => void }) {
  const toast = useToast();
  const acao = useAcaoProcesso();
  const f = processo.fichaRecepcao;
  const [paginas, setPaginas] = useState<FicheiroPendente[]>([]);
  const [errosFicheiros, setErrosFicheiros] = useState<string[]>([]);
  const [km, setKm] = useState(f.km !== undefined ? String(f.km) : '');
  const [combustivel, setCombustivel] = useState<string | undefined>(f.combustivel !== undefined ? String(f.combustivel) : undefined);
  const [pertences, setPertences] = useState(f.pertences && f.pertences !== 'Nenhum' ? f.pertences : '');
  const [progresso, setProgresso] = useState<string | null>(null);
  const substituir = !!f.digitalizacaoIds?.length;

  async function guardar() {
    if (paginas.length === 0) return toast('Junte a ficha assinada: uma fotografia por página, ou o PDF.', 'erro');
    if (km === '') return toast('Indique a quilometragem escrita na ficha.', 'erro');
    try {
      const ids: string[] = [];
      for (const [i, pg] of paginas.entries()) {
        setProgresso(`A enviar a página ${i + 1} de ${paginas.length}…`);
        const anexo = await api.anexos.enviar(processo.id, pg.ficheiro, {
          tipo: pg.tipo === 'documento' ? 'documento' : 'foto', finalidade: 'ficha_entrada', nome: pg.nome, legenda: `Ficha de entrada — página ${i + 1}`,
        });
        ids.push(anexo.id);
      }
      setProgresso('A guardar…');
      await acao.mutateAsync(() => api.processos.registarFichaEntrada(processo.id, {
        digitalizacaoIds: ids, km: Number(km), combustivel: combustivel ? Number(combustivel) : undefined, pertences: pertences.trim() || undefined,
      }));
      paginas.forEach((pg) => pg.previsualizacao && URL.revokeObjectURL(pg.previsualizacao));
      toast(substituir ? 'Ficha de entrada substituída' : 'Ficha de entrada guardada');
      onFechar();
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setProgresso(null);
    }
  }

  return (
    <Drawer
      open
      onClose={onFechar}
      titulo={substituir ? 'Substituir a ficha de entrada' : 'Carregar a ficha de entrada assinada'}
      subtitulo={`${processo.viatura.matricula} · ${processo.cliente.nome}`}
      rodape={
        <>
          {progresso && <span className="mr-auto text-xs text-mzd-gray" role="status">{progresso}</span>}
          <Button variante="fantasma" onClick={onFechar} disabled={!!progresso}>Cancelar</Button>
          <Button onClick={guardar} carregando={!!progresso} disabled={paginas.length === 0 || km === ''}>Guardar ficha</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-mzd-black">Ficha preenchida e assinada pelo cliente</p>
          {paginas.length > 0 && (
            <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {paginas.map((pg) => (
                <MiniaturaPendente key={pg.id} f={pg} onRemover={() => setPaginas(paginas.filter((x) => x.id !== pg.id))} />
              ))}
            </div>
          )}
          <SeletorFicheiros
            aceitarVideo={false}
            aceitarPdf
            rotulo={paginas.length ? 'Juntar outra página' : 'Fotografar ou escolher a ficha'}
            onEscolher={(novos, erros) => { setErrosFicheiros(erros); setPaginas([...paginas, ...novos]); }}
          />
          {errosFicheiros.map((m) => <p key={m} className="mt-1 text-xs text-sinal-vermelho">{m}</p>)}
        </div>

        <div className="rounded-md border border-linha bg-white p-4">
          <p className="rotulo mb-3">Copie da ficha</p>
          <div className="space-y-4">
            <Field label="Quilometragem (km)" hint={processo.viatura.km ? `Último registo da viatura: ${processo.viatura.km.toLocaleString('pt-PT')} km` : 'Como está escrito na ficha'}>
              {(a) => <Input {...a} value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="num text-base" autoFocus />}
            </Field>
            <Escolha label="Combustível (opcional)" valor={combustivel} onChange={setCombustivel} opcoes={COMBUSTIVEL} />
            <Field label="Pertences deixados na viatura" hint="Opcional — são conferidos na entrega">
              {(a) => <Input {...a} value={pertences} onChange={(e) => setPertences(e.target.value)} placeholder="Nenhum" />}
            </Field>
          </div>
        </div>
        <Aviso tom="neutro">Os danos e as restantes verificações ficam na ficha digitalizada, com a assinatura do cliente.</Aviso>
      </div>
    </Drawer>
  );
}
