import { Fragment, useRef, useState } from 'react';
import { Pencil, RotateCcw } from 'lucide-react';
import { useAlterarModelo, useConfiguracao, useModelos } from '../../api/hooks';
import { api } from '../../api/endpoints';
import { useAuth } from '../../auth/useAuth';
import type { ModeloMensagem } from '../../types';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Drawer from '../../components/ui/Drawer';
import { Field, Input, Textarea } from '../../components/ui/Form';
import { Aviso } from '../../components/ui/Controls';
import { Carregando } from '../../components/ui/Estados';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';
import { formatDate } from '../../lib/format';
import { MODELOS_PADRAO, preencherModelo, textoCoordenadas, VALORES_EXEMPLO, VARIAVEIS_MODELO, variaveisDesconhecidas } from '../../lib/mensagens';

/** Texto do modelo com as variáveis destacadas. */
function TextoComVariaveis({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\{[a-z_]+\})/g).map((parte, i) =>
        /^\{[a-z_]+\}$/.test(parte)
          ? <span key={i} className="num rounded-sm bg-zinc-100 px-1 text-[11.5px] text-mzd-black">{parte}</span>
          : <Fragment key={i}>{parte}</Fragment>,
      )}
    </>
  );
}

export default function Modelos() {
  const { can } = useAuth();
  const { data: modelos, isPending } = useModelos();
  const [aberto, setAberto] = useState<ModeloMensagem | null>(null);
  if (isPending || !modelos) return <Carregando />;
  const editar = can('definicoes.gerir');

  return (
    <div className="space-y-3">
      <p className="max-w-3xl text-[13px] text-mzd-gray">
        Os modelos dão o texto inicial de cada mensagem; quem envia pode sempre ajustá-lo. As palavras entre chavetas
        são substituídas pelos dados do cliente e do processo.{!editar && ' Só a Direção pode alterar os modelos.'}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {modelos.map((m) => (
          <Card key={m.chave} className="flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-linha px-5 py-3">
              <div className="min-w-0">
                <h2 className="text-[13.5px] font-bold text-mzd-black">{m.nome}</h2>
                <p className="text-xs text-mzd-gray">{m.descricao}</p>
              </div>
              {editar && <Button variante="fantasma" tamanho="sm" icone={<Pencil size={13} />} onClick={() => setAberto(m)}>Editar</Button>}
            </div>
            <p className="flex-1 whitespace-pre-line px-5 py-3 text-[13px] leading-relaxed text-mzd-graphite"><TextoComVariaveis texto={m.texto} /></p>
            {m.atualizadoEm && <p className="border-t border-linha/70 px-5 py-2 text-[11.5px] text-mzd-gray">Alterado em {formatDate(m.atualizadoEm)}</p>}
          </Card>
        ))}
      </div>
      {aberto && <EditorModelo modelo={aberto} onFechar={() => setAberto(null)} />}
    </div>
  );
}

function EditorModelo({ modelo, onFechar }: { modelo: ModeloMensagem; onFechar: () => void }) {
  const toast = useToast();
  const alterar = useAlterarModelo();
  const { data: config } = useConfiguracao();
  const [d, setD] = useState({ nome: modelo.nome, assunto: modelo.assunto, texto: modelo.texto });
  const area = useRef<HTMLTextAreaElement>(null);
  const desconhecidas = variaveisDesconhecidas(`${d.assunto}\n${d.texto}`);
  const exemplo = { ...VALORES_EXEMPLO, oficina: config?.empresa.nome ?? VALORES_EXEMPLO.oficina, telefone_oficina: config?.empresa.telefone, coordenadas: textoCoordenadas(config?.coordenadasPagamento) ?? VALORES_EXEMPLO.coordenadas, iban: config?.coordenadasPagamento[0]?.iban ?? VALORES_EXEMPLO.iban };
  const original = MODELOS_PADRAO.find((x) => x.chave === modelo.chave);
  const igualOriginal = !!original && original.nome === d.nome && original.assunto === d.assunto && original.texto === d.texto;

  /** Insere a variável onde está o cursor. */
  function inserir(chave: string) {
    const el = area.current;
    const marca = `{${chave}}`;
    const ini = el?.selectionStart ?? d.texto.length;
    const fim = el?.selectionEnd ?? d.texto.length;
    setD({ ...d, texto: d.texto.slice(0, ini) + marca + d.texto.slice(fim) });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(ini + marca.length, ini + marca.length); });
  }

  const guardar = () => alterar.mutate(() => api.modelos.guardar(modelo.chave, d), {
    onSuccess: () => { toast('Modelo guardado'); onFechar(); },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  });
  const repor = () => alterar.mutate(() => api.modelos.repor(modelo.chave), {
    onSuccess: () => { toast('Modelo reposto'); onFechar(); },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  });

  return (
    <Drawer
      open
      onClose={onFechar}
      largura="lg"
      titulo={`Modelo: ${modelo.nome}`}
      subtitulo={modelo.descricao}
      rodape={
        <>
          {!igualOriginal && <Button variante="fantasma" icone={<RotateCcw size={14} />} onClick={repor} className="mr-auto">Repor o original</Button>}
          <Button variante="fantasma" onClick={onFechar}>Cancelar</Button>
          <Button onClick={guardar} carregando={alterar.isPending} disabled={desconhecidas.length > 0}>Guardar</Button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_17rem]">
        <div className="space-y-4">
          <Field label="Nome">{(a) => <Input {...a} value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} maxLength={60} />}</Field>
          <Field label="Assunto do email">{(a) => <Input {...a} value={d.assunto} onChange={(e) => setD({ ...d, assunto: e.target.value })} maxLength={150} />}</Field>
          <Field label="Texto" hint="Uma linha cuja variável não tem valor é omitida (ex.: o valor, para quem não vê preços).">
            {(a) => <Textarea {...a} ref={area} rows={10} value={d.texto} onChange={(e) => setD({ ...d, texto: e.target.value })} maxLength={1500} />}
          </Field>
          {desconhecidas.length > 0 && (
            <Aviso tom="vermelho">Variável desconhecida: {desconhecidas.map((v) => `{${v}}`).join(', ')}. Use as da lista.</Aviso>
          )}
          <div>
            <p className="rotulo mb-2">Pré-visualização com dados de exemplo</p>
            <div className="rounded-md border border-linha bg-white px-4 py-3">
              <p className="mb-2 border-b border-linha/70 pb-2 text-xs font-semibold text-mzd-gray">{preencherModelo(d.assunto, exemplo)}</p>
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-mzd-graphite">{preencherModelo(d.texto, exemplo)}</p>
            </div>
          </div>
        </div>
        <div>
          <p className="rotulo mb-2">Variáveis — clique para inserir</p>
          <ul className="space-y-1">
            {VARIAVEIS_MODELO.map((v) => (
              <li key={v.chave}>
                <button type="button" onClick={() => inserir(v.chave)} className="w-full rounded-md px-2 py-1.5 text-left hover:bg-white">
                  <span className="num block text-xs font-semibold text-mzd-black">{`{${v.chave}}`}</span>
                  <span className="block text-[11.5px] text-mzd-gray">{v.descricao}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Drawer>
  );
}
