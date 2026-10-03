import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAlterarStock, useFornecedores, useMovimentos, useUtilizadores } from '../../api/hooks';
import { api } from '../../api/endpoints';
import type { DadosPeca } from '../../api/endpoints';
import type { PecaResumo } from '../../types';
import { TIPO_MOVIMENTO_LABEL } from '../../types';
import Drawer from '../../components/ui/Drawer';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Tabs from '../../components/ui/Tabs';
import { Field, Input, Select, Textarea } from '../../components/ui/Form';
import { Table, Th, Tr, Td, LinhaVazia } from '../../components/ui/Table';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';
import { formatDateTime } from '../../lib/format';
import { margem } from '../../lib/calculos';

const num = (msg: string) => z.coerce.number({ error: 'Valor inválido.' }).min(0, msg);
const esquema = z.object({
  referencia: z.string().trim().min(2, 'Indique a referência.'),
  nome: z.string().trim().min(3, 'Indique o nome (mínimo 3 caracteres).'),
  categoria: z.string().trim().min(2, 'Indique a categoria.'),
  fornecedorId: z.string().min(1, 'Escolha o fornecedor.'),
  precoCusto: num('Não pode ser negativo.'),
  precoBase: z.coerce.number({ error: 'Valor inválido.' }).positive('Tem de ser maior que zero.'),
  stockMinimo: num('Não pode ser negativo.').int('Número inteiro.'),
  localizacao: z.string().trim().optional().transform((v) => v || undefined),
  stock: num('Não pode ser negativo.').int('Número inteiro.').optional(),
}).refine((d) => d.precoBase >= d.precoCusto, { path: ['precoBase'], message: 'O preço de venda é inferior ao custo.' });
type Entrada = z.input<typeof esquema>;

/** Criar ou editar uma peça do catálogo (custo, venda e margem). */
export function FormPeca({ peca, onFechar }: { peca?: PecaResumo; onFechar: () => void }) {
  const toast = useToast();
  const alterar = useAlterarStock<PecaResumo>();
  const { data: fornecedores = [] } = useFornecedores();
  const { register, handleSubmit, control, formState: { errors, isDirty } } = useForm<Entrada, unknown, DadosPeca>({
    resolver: zodResolver(esquema),
    defaultValues: peca
      ? { referencia: peca.referencia, nome: peca.nome, categoria: peca.categoria, fornecedorId: peca.fornecedorId, precoCusto: String(peca.precoCusto), precoBase: String(peca.precoBase), stockMinimo: String(peca.stockMinimo), localizacao: peca.localizacao ?? '' }
      : { referencia: '', nome: '', categoria: '', fornecedorId: '', precoCusto: '', precoBase: '', stockMinimo: '0', localizacao: '', stock: '0' },
  });
  const [custoTxt, vendaTxt] = useWatch({ control, name: ['precoCusto', 'precoBase'] });
  const custo = Number(custoTxt) || 0;
  const venda = Number(vendaTxt) || 0;

  const submeter = handleSubmit((dados) =>
    alterar.mutate(() => (peca ? api.pecas.editar(peca.id, dados) : api.pecas.criar(dados)), {
      onSuccess: (p) => {
        toast(peca ? 'Peça atualizada' : `"${p.nome}" adicionada ao catálogo`);
        onFechar();
      },
      onError: (e) => toast(mensagemErro(e), 'erro'),
    })
  );

  return (
    <Drawer
      open
      onClose={onFechar}
      titulo={peca ? 'Editar peça' : 'Nova peça'}
      rodape={
        <>
          <Button variante="fantasma" onClick={onFechar}>Cancelar</Button>
          <Button onClick={submeter} carregando={alterar.isPending} disabled={!!peca && !isDirty}>{peca ? 'Guardar' : 'Adicionar ao catálogo'}</Button>
        </>
      }
    >
      <form onSubmit={submeter} noValidate className="grid grid-cols-2 gap-4">
        <Field label="Referência" erro={errors.referencia?.message}>{(a) => <Input {...a} {...register('referencia')} className="num uppercase" autoFocus />}</Field>
        <Field label="Localização" hint="Prateleira/estante — opcional">{(a) => <Input {...a} {...register('localizacao')} />}</Field>
        <Field label="Nome da peça" erro={errors.nome?.message} className="col-span-2">{(a) => <Input {...a} {...register('nome')} />}</Field>
        <Field label="Categoria" erro={errors.categoria?.message}>{(a) => <Input {...a} {...register('categoria')} placeholder="Ex.: Travões" />}</Field>
        <Field label="Fornecedor" erro={errors.fornecedorId?.message}>
          {(a) => (
            <Select {...a} {...register('fornecedorId')}>
              <option value="">Escolher…</option>
              {fornecedores.filter((f) => f.ativo || f.id === peca?.fornecedorId).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Preço de custo (Kz)" hint="Sem IVA" erro={errors.precoCusto?.message}>{(a) => <Input {...a} {...register('precoCusto')} inputMode="decimal" className="num" />}</Field>
        <Field label="Preço de venda (Kz)" hint={venda ? `Margem ${margem(custo, venda)}%` : 'Sem IVA'} erro={errors.precoBase?.message}>{(a) => <Input {...a} {...register('precoBase')} inputMode="decimal" className="num" />}</Field>
        <Field label="Stock mínimo" hint="Abaixo disto entra na sugestão de encomenda" erro={errors.stockMinimo?.message}>{(a) => <Input {...a} {...register('stockMinimo')} inputMode="numeric" className="num" />}</Field>
        {!peca && <Field label="Stock inicial" hint="Fica registado como movimento" erro={errors.stock?.message}>{(a) => <Input {...a} {...register('stock')} inputMode="numeric" className="num" />}</Field>}
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}

/** Detalhe da peça: dados, acerto de inventário e histórico de movimentos. */
export function DetalhePeca({ peca, onFechar, onEditar }: { peca: PecaResumo; onFechar: () => void; onEditar: () => void }) {
  const [acerto, setAcerto] = useState(false);
  const { data: movimentos = [] } = useMovimentos(peca.id);
  const { data: utilizadores = [] } = useUtilizadores();
  const nome = (id: string) => utilizadores.find((u) => u.id === id)?.nome ?? id;

  return (
    <Drawer
      open
      onClose={onFechar}
      largura="lg"
      titulo={peca.nome}
      subtitulo={<span className="num">{peca.referencia}{peca.localizacao ? ` · ${peca.localizacao}` : ''} · {peca.fornecedor}</span>}
      rodape={
        <>
          <Button variante="secundario" onClick={() => setAcerto(true)}>Acertar inventário</Button>
          <Button onClick={onEditar}>Editar peça</Button>
        </>
      }
    >
      <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-linha bg-linha sm:grid-cols-4">
        {[
          ['Stock físico', peca.stock],
          ['Reservado', peca.reservado],
          ['Disponível', peca.disponivel],
          ['A caminho', peca.encomendado],
        ].map(([l, v]) => (
          <div key={l as string} className="bg-white px-4 py-3">
            <dt className="rotulo">{l}</dt>
            <dd className={`num mt-1 text-xl font-semibold ${l === 'Disponível' && (v as number) < 0 ? 'text-sinal-vermelho' : 'text-mzd-black'}`}>{v}</dd>
          </div>
        ))}
      </dl>
      <Tabs
        tabs={[{
          id: 'mov',
          label: 'Movimentos',
          badge: movimentos.length,
          content: (
            <Table>
              <thead>
                <tr><Th>Data</Th><Th>Tipo</Th><Th direita>Qtd.</Th><Th direita>Stock</Th><Th>Por</Th><Th>Motivo</Th></tr>
              </thead>
              <tbody>
                {movimentos.map((m) => (
                  <Tr key={m.id}>
                    <Td num className="whitespace-nowrap text-mzd-gray">{formatDateTime(m.data)}</Td>
                    <Td>{TIPO_MOVIMENTO_LABEL[m.tipo]}</Td>
                    <Td direita num className={m.quantidade < 0 ? 'text-sinal-vermelho' : 'text-sinal-verde'}>{m.quantidade > 0 ? '+' : ''}{m.quantidade}</Td>
                    <Td direita num>{m.stockApos}</Td>
                    <Td className="text-mzd-gray">{nome(m.utilizadorId)}</Td>
                    <Td className="text-mzd-gray">{m.motivo ?? '—'}</Td>
                  </Tr>
                ))}
                {movimentos.length === 0 && <LinhaVazia colunas={6}>Sem movimentos.</LinhaVazia>}
              </tbody>
            </Table>
          ),
        }]}
      />
      {acerto && <AcertoInventario peca={peca} onFechar={() => setAcerto(false)} />}
    </Drawer>
  );
}

function AcertoInventario({ peca, onFechar }: { peca: PecaResumo; onFechar: () => void }) {
  const toast = useToast();
  const alterar = useAlterarStock<PecaResumo>();
  const [contado, setContado] = useState(String(peca.stock));
  const [motivo, setMotivo] = useState('');
  const diferenca = Number(contado) - peca.stock;

  return (
    <Modal
      open
      onClose={onFechar}
      title="Acerto de inventário"
      footer={
        <>
          <Button variante="fantasma" onClick={onFechar}>Cancelar</Button>
          <Button
            carregando={alterar.isPending}
            disabled={!diferenca || motivo.trim().length < 5 || contado === ''}
            onClick={() => alterar.mutate(() => api.pecas.acerto(peca.id, Number(contado), motivo), {
              onSuccess: () => { toast('Inventário acertado'); onFechar(); },
              onError: (e) => toast(mensagemErro(e), 'erro'),
            })}
          >
            Registar acerto
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-mzd-gray">Conte as unidades na prateleira. O stock passa a ser o valor contado e a diferença fica registada.</p>
        <Field label="Unidades contadas" hint={`Registado no sistema: ${peca.stock}`}>
          {(a) => <Input {...a} value={contado} onChange={(e) => setContado(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="num text-base" autoFocus />}
        </Field>
        {diferenca !== 0 && contado !== '' && (
          <p className={`num text-sm font-semibold ${diferenca < 0 ? 'text-sinal-vermelho' : 'text-sinal-verde'}`}>Diferença: {diferenca > 0 ? '+' : ''}{diferenca}</p>
        )}
        <Field label="Motivo" hint="Obrigatório — ex.: contagem mensal, peça danificada, erro de registo">
          {(a) => <Textarea {...a} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  );
}
