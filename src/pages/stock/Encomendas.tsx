import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useAlterarStock, useEncomendas, useFornecedores, usePecas, useProcessos, useSugestaoEncomendas } from '../../api/hooks';
import { api } from '../../api/endpoints';
import type { Encomenda, LinhaEncomenda } from '../../types';
import { ESTADO_ENCOMENDA_LABEL } from '../../types';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Drawer from '../../components/ui/Drawer';
import Modal from '../../components/ui/Modal';
import Kz from '../../components/ui/Kz';
import { Aviso } from '../../components/ui/Controls';
import { Checkbox, Field, Input, Select, Textarea } from '../../components/ui/Form';
import { Table, Th, Tr, Td, LinhaVazia } from '../../components/ui/Table';
import { Carregando, Vazio } from '../../components/ui/Estados';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';
import { formatDate } from '../../lib/format';

const totalEncomenda = (e: Pick<Encomenda, 'linhas'>) => e.linhas.reduce((s, l) => s + l.quantidade * l.precoCusto, 0);

export default function Encomendas() {
  const { data: encomendas, isPending } = useEncomendas();
  const { data: fornecedores = [] } = useFornecedores();
  const [nova, setNova] = useState(false);
  const [sugestao, setSugestao] = useState(false);
  const [aberta, setAberta] = useState<Encomenda | null>(null);
  const [hoje] = useState(() => new Date().toISOString());
  const nomeForn = (id: string) => fornecedores.find((f) => f.id === id)?.nome ?? '—';
  if (isPending || !encomendas) return <Carregando />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variante="secundario" icone={<Sparkles size={15} />} onClick={() => setSugestao(true)}>Sugerir encomendas</Button>
        <Button icone={<Plus size={15} />} onClick={() => setNova(true)}>Nova encomenda</Button>
      </div>
      <Card>
        <Table>
          <thead>
            <tr><Th>Encomenda</Th><Th>Fornecedor</Th><Th>Estado</Th><Th direita>Linhas</Th><Th direita>Total (custo)</Th><Th>Previsão / receção</Th></tr>
          </thead>
          <tbody>
            {encomendas.map((e) => {
              const atrasada = e.estado === 'enviada' && e.previsaoEntrega && e.previsaoEntrega < hoje;
              return (
                <Tr key={e.id} className="cursor-pointer" onClick={() => setAberta(e)}>
                  <Td><button type="button" className="num font-semibold text-mzd-black hover:underline">{e.numero}</button></Td>
                  <Td>{nomeForn(e.fornecedorId)}</Td>
                  <Td>
                    <span className={clsx('rotulo', e.estado === 'enviada' && '!text-sinal-ambar', e.estado === 'recebida' && '!text-sinal-verde')}>{ESTADO_ENCOMENDA_LABEL[e.estado]}</span>
                  </Td>
                  <Td direita num>{e.linhas.length}</Td>
                  <Td direita><Kz valor={totalEncomenda(e)} /></Td>
                  <Td num className={atrasada ? 'font-semibold text-sinal-vermelho' : 'text-mzd-gray'}>
                    {e.recebidaEm ? `Recebida ${formatDate(e.recebidaEm)}` : e.previsaoEntrega ? `${atrasada ? 'Atrasada · ' : ''}${formatDate(e.previsaoEntrega)}` : '—'}
                  </Td>
                </Tr>
              );
            })}
            {encomendas.length === 0 && <LinhaVazia colunas={6}>Ainda não há encomendas.</LinhaVazia>}
          </tbody>
        </Table>
      </Card>
      {nova && <FormEncomenda onFechar={() => setNova(false)} />}
      {sugestao && <Sugestao onFechar={() => setSugestao(false)} />}
      {aberta && <DetalheEncomenda encomenda={aberta} onFechar={() => setAberta(null)} />}
    </div>
  );
}

function FormEncomenda({ onFechar, inicial }: { onFechar: () => void; inicial?: { fornecedorId: string; linhas: LinhaEncomenda[] } }) {
  const toast = useToast();
  const alterar = useAlterarStock<Encomenda>();
  const { data: fornecedores = [] } = useFornecedores();
  const { data: pecas = [] } = usePecas();
  const [fornecedorId, setFornecedorId] = useState(inicial?.fornecedorId ?? '');
  const [linhas, setLinhas] = useState<LinhaEncomenda[]>(inicial?.linhas ?? []);
  const [notas, setNotas] = useState('');
  const doFornecedor = pecas.filter((p) => p.fornecedorId === fornecedorId);
  const setLinha = (i: number, l: Partial<LinhaEncomenda>) => setLinhas((ls) => ls.map((x, k) => (k === i ? { ...x, ...l } : x)));

  return (
    <Drawer
      open
      onClose={onFechar}
      titulo="Nova encomenda"
      subtitulo="Fica em rascunho até ser enviada ao fornecedor"
      rodape={
        <>
          <span className="mr-auto text-sm">Total: <Kz valor={totalEncomenda({ linhas })} className="font-semibold" /></span>
          <Button variante="fantasma" onClick={onFechar}>Cancelar</Button>
          <Button
            carregando={alterar.isPending}
            disabled={!fornecedorId || linhas.length === 0}
            onClick={() => alterar.mutate(() => api.encomendas.criar({ fornecedorId, linhas, notas: notas.trim() || undefined }), {
              onSuccess: (e) => { toast(`Encomenda ${e.numero} criada em rascunho`); onFechar(); },
              onError: (e) => toast(mensagemErro(e), 'erro'),
            })}
          >
            Criar rascunho
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Fornecedor">
          {(a) => (
            <Select {...a} value={fornecedorId} onChange={(e) => { setFornecedorId(e.target.value); setLinhas([]); }}>
              <option value="">Escolher…</option>
              {fornecedores.filter((f) => f.ativo).map((f) => <option key={f.id} value={f.id}>{f.nome} · entrega em {f.prazoEntregaDias} dia(s)</option>)}
            </Select>
          )}
        </Field>
        {fornecedorId && (
          <section>
            <h3 className="rotulo mb-2">Peças</h3>
            <div className="space-y-2">
              {linhas.map((l, i) => {
                const p = pecas.find((x) => x.id === l.pecaId);
                return (
                  <div key={l.pecaId} className="grid grid-cols-[1fr_70px_110px_32px] items-center gap-2">
                    <span className="text-[13px]">
                      <span className="block font-medium text-mzd-black">{p?.nome}</span>
                      <span className="num block text-[11px] text-mzd-gray">stock {p?.stock} · disponível {p?.disponivel} · mín. {p?.stockMinimo}</span>
                    </span>
                    <Input value={String(l.quantidade)} onChange={(e) => setLinha(i, { quantidade: Number(e.target.value.replace(/\D/g, '')) || 0 })} className="num text-right" aria-label="Quantidade" />
                    <Input value={String(l.precoCusto)} onChange={(e) => setLinha(i, { precoCusto: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 })} className="num text-right" aria-label="Custo unitário" />
                    <button type="button" onClick={() => setLinhas((ls) => ls.filter((_, k) => k !== i))} className="flex h-10 items-center justify-center text-mzd-gray hover:text-mzd-black" aria-label="Remover"><Trash2 size={15} /></button>
                  </div>
                );
              })}
            </div>
            <Select
              value=""
              onChange={(e) => {
                const p = pecas.find((x) => x.id === e.target.value);
                if (p) setLinhas((ls) => [...ls, { pecaId: p.id, quantidade: Math.max(1, p.stockMinimo * 2 - p.disponivel - p.encomendado), precoCusto: p.precoCusto }]);
              }}
              className="mt-2"
              aria-label="Adicionar peça"
            >
              <option value="">+ Adicionar peça deste fornecedor…</option>
              {doFornecedor.filter((p) => !linhas.some((l) => l.pecaId === p.id)).map((p) => <option key={p.id} value={p.id}>{p.nome} (disp. {p.disponivel})</option>)}
            </Select>
          </section>
        )}
        <Field label="Notas" hint="Opcional">{(a) => <Textarea {...a} rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />}</Field>
      </div>
    </Drawer>
  );
}

function Sugestao({ onFechar }: { onFechar: () => void }) {
  const toast = useToast();
  const alterar = useAlterarStock<Encomenda>();
  const { data: sugestoes, isPending } = useSugestaoEncomendas();
  const { data: fornecedores = [] } = useFornecedores();
  const { data: pecas = [] } = usePecas();
  const { data: processos = [] } = useProcessos();
  const [escolhidos, setEscolhidos] = useState<Set<string> | null>(null);
  const marcados = escolhidos ?? new Set((sugestoes ?? []).map((s) => s.fornecedorId));

  async function criar() {
    const lista = (sugestoes ?? []).filter((s) => marcados.has(s.fornecedorId));
    try {
      for (const s of lista) await alterar.mutateAsync(() => api.encomendas.criar({ fornecedorId: s.fornecedorId, linhas: s.linhas, processosIds: s.processosIds, notas: 'Gerada pela sugestão automática' }));
      toast(`${lista.length} encomenda(s) criada(s) em rascunho`);
      onFechar();
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onFechar}
      title="Sugestão de encomendas"
      footer={
        <>
          <Button variante="fantasma" onClick={onFechar}>Fechar</Button>
          <Button onClick={criar} carregando={alterar.isPending} disabled={marcados.size === 0}>Criar {marcados.size} rascunho(s)</Button>
        </>
      }
    >
      {isPending ? <Carregando /> : !sugestoes?.length ? (
        <Vazio titulo="Nada a encomendar">Todas as peças têm stock acima do mínimo, contando com reservas e encomendas a caminho.</Vazio>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-mzd-gray">Calculada com o stock disponível (descontando reservas) e o que já está encomendado. Repõe até ao dobro do mínimo.</p>
          {sugestoes.map((s) => (
            <div key={s.fornecedorId} className="rounded-md border border-linha bg-white p-4">
              <Checkbox
                checked={marcados.has(s.fornecedorId)}
                onChange={(v) => { const n = new Set(marcados); if (v) n.add(s.fornecedorId); else n.delete(s.fornecedorId); setEscolhidos(n); }}
              >
                <span className="font-semibold">{fornecedores.find((f) => f.id === s.fornecedorId)?.nome}</span>
                <span className="ml-2 text-mzd-gray">· <Kz valor={totalEncomenda(s)} /></span>
              </Checkbox>
              <ul className="mt-2 space-y-0.5 pl-7 text-[13px]">
                {s.linhas.map((l, i) => (
                  <li key={l.pecaId}>
                    <span className="num font-semibold">{l.quantidade}×</span> {pecas.find((p) => p.id === l.pecaId)?.nome}
                    <span className="block text-xs text-mzd-gray">{s.motivos[i]}</span>
                  </li>
                ))}
              </ul>
              {s.processosIds.length > 0 && (
                <p className="mt-2 pl-7 text-xs text-sinal-ambar">Desbloqueia: {s.processosIds.map((id) => processos.find((p) => p.id === id)?.numero).join(', ')}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function DetalheEncomenda({ encomenda: e, onFechar }: { encomenda: Encomenda; onFechar: () => void }) {
  const toast = useToast();
  const alterar = useAlterarStock<unknown>();
  const { data: pecas = [] } = usePecas();
  const { data: fornecedores = [] } = useFornecedores();
  const { data: processos = [] } = useProcessos();
  const [recebidas, setRecebidas] = useState<Record<string, string>>(() => Object.fromEntries(e.linhas.map((l) => [l.pecaId, String(l.quantidadeRecebida ?? l.quantidade)])));
  const f = fornecedores.find((x) => x.id === e.fornecedorId);
  const diferencas = e.linhas.filter((l) => Number(recebidas[l.pecaId]) !== l.quantidade).length;

  const correr = (fn: () => Promise<unknown>, msg: (r: any) => string) =>
    alterar.mutate(fn, { onSuccess: (r) => { toast(msg(r)); onFechar(); }, onError: (err) => toast(mensagemErro(err), 'erro') });

  return (
    <Drawer
      open
      onClose={onFechar}
      titulo={`Encomenda ${e.numero}`}
      subtitulo={`${f?.nome ?? ''} · ${ESTADO_ENCOMENDA_LABEL[e.estado]}${f?.telefone ? ` · ${f.telefone}` : ''}`}
      rodape={
        <>
          {(e.estado === 'rascunho' || e.estado === 'enviada') && (
            <Button variante="fantasma" onClick={() => correr(() => api.encomendas.cancelar(e.id), () => 'Encomenda cancelada')}>Cancelar encomenda</Button>
          )}
          {e.estado === 'rascunho' && <Button onClick={() => correr(() => api.encomendas.enviar(e.id), () => 'Encomenda marcada como enviada')}>Marcar como enviada</Button>}
          {e.estado === 'enviada' && (
            <Button
              carregando={alterar.isPending}
              onClick={() => correr(
                () => api.encomendas.receber(e.id, e.linhas.map((l) => ({ pecaId: l.pecaId, quantidadeRecebida: Number(recebidas[l.pecaId]) || 0 }))),
                (r) => `Encomenda recebida — stock atualizado${r.desbloqueados?.length ? ` · desbloqueou ${r.desbloqueados.join(', ')}` : ''}`
              )}
            >
              Registar receção
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        {e.estado === 'enviada' && <Aviso tom="neutro">Confira as quantidades que chegaram. A entrada em stock e a atualização do custo médio são feitas ao registar a receção.</Aviso>}
        <Table>
          <thead>
            <tr><Th>Peça</Th><Th direita>Pedido</Th>{e.estado !== 'rascunho' && <Th direita>Recebido</Th>}<Th direita>Custo unit.</Th><Th direita>Total</Th></tr>
          </thead>
          <tbody>
            {e.linhas.map((l) => (
              <Tr key={l.pecaId}>
                <Td className="font-medium text-mzd-black">{pecas.find((p) => p.id === l.pecaId)?.nome}</Td>
                <Td direita num>{l.quantidade}</Td>
                {e.estado === 'enviada' && (
                  <Td direita>
                    <Input value={recebidas[l.pecaId]} onChange={(ev) => setRecebidas({ ...recebidas, [l.pecaId]: ev.target.value.replace(/\D/g, '') })} className="num ml-auto h-8 w-20 text-right" aria-label={`Recebido de ${pecas.find((p) => p.id === l.pecaId)?.nome}`} />
                  </Td>
                )}
                {e.estado === 'recebida' && <Td direita num className={l.quantidadeRecebida !== l.quantidade ? 'font-semibold text-sinal-ambar' : ''}>{l.quantidadeRecebida}</Td>}
                {e.estado === 'cancelada' && <Td direita num>—</Td>}
                <Td direita><Kz valor={l.precoCusto} className="text-mzd-gray" /></Td>
                <Td direita><Kz valor={l.quantidade * l.precoCusto} /></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        {e.estado === 'enviada' && diferencas > 0 && <Aviso>{diferencas} linha(s) com quantidade diferente do pedido — fica registado.</Aviso>}
        <dl className="grid grid-cols-2 gap-3 text-[13px]">
          <div><dt className="rotulo">Criada</dt><dd className="num">{formatDate(e.criadoEm)}</dd></div>
          {e.previsaoEntrega && <div><dt className="rotulo">Previsão de entrega</dt><dd className="num">{formatDate(e.previsaoEntrega)}</dd></div>}
          {e.processosIds.length > 0 && (
            <div className="col-span-2">
              <dt className="rotulo">Processos à espera</dt>
              <dd className="flex flex-wrap gap-2">{e.processosIds.map((id) => { const p = processos.find((x) => x.id === id); return p ? <Link key={id} to={`/processos/${id}`} className="num underline underline-offset-4">{p.numero}</Link> : null; })}</dd>
            </div>
          )}
          {e.notas && <div className="col-span-2"><dt className="rotulo">Notas</dt><dd>{e.notas}</dd></div>}
        </dl>
      </div>
    </Drawer>
  );
}

