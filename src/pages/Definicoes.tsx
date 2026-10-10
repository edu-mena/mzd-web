import { Link } from 'react-router-dom';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Plus, Trash2 } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Tabs from '../components/ui/Tabs';
import { Field, Input, Textarea } from '../components/ui/Form';
import { textoCondicoes } from '../lib/calculos';
import { Carregando, ErroCarregamento } from '../components/ui/Estados';
import { useToast } from '../components/ui/toast-context';
import { useConfiguracao, useGuardarConfiguracao } from '../api/hooks';
import { useAuth } from '../auth/useAuth';
import type { Configuracao } from '../types';
import { mensagemErro } from '../lib/erros';

export default function Definicoes() {
  const { can } = useAuth();
  return (
    <div className="pagina space-y-5">
      <PageHeader titulo="Definições" descricao="Dados da empresa, preços-base, condições comerciais e coordenadas de pagamento" />
      <Tabs
        tabs={[
          { id: 'empresa', label: 'Empresa, preços e pagamentos', content: <EmpresaPrecos /> },
          { id: 'modelos', label: 'Modelos de documentos', content: <Modelos /> },
        ]}
      />
      {can('auditoria.ver') && (
        <p className="text-xs text-mzd-gray">
          Utilizadores, permissões, auditoria e cópias de segurança estão em <Link to="/administracao" className="font-semibold text-mzd-black underline-offset-4 hover:underline">Administração</Link>.
        </p>
      )}
    </div>
  );
}

// ---------- Empresa & Preços ----------

const numero = (msg: string) => z.coerce.number({ error: 'Valor inválido.' }).min(0, msg);
const pct = numero('Não pode ser negativo.').max(100, 'Máximo 100%.');
const esquemaConfig = z.object({
  empresa: z.object({
    nome: z.string().trim().min(2, 'Obrigatório.'),
    nif: z.string().trim().min(5, 'NIF inválido.'),
    morada: z.string().trim().min(2, 'Obrigatório.'),
    telefone: z.string().trim().min(6, 'Telefone inválido.'),
    email: z.string().trim().email('Email inválido.'),
  }),
  coordenadasPagamento: z.array(z.object({
    id: z.string(),
    banco: z.string().trim().min(2, 'Indique o banco.'),
    titular: z.string().trim().min(3, 'Indique o titular.'),
    iban: z.string().trim().toUpperCase().regex(/^AO\d{2}(\s?\d){21}$/, 'IBAN angolano: AO + 23 algarismos.'),
    conta: z.string().trim().optional(),
  })).max(5, 'Máximo de 5 contas.'),
  instrucoesPagamento: z.string().trim().max(300, 'Máximo 300 caracteres.').optional(),
  taxaIva: pct,
  motivoIsencaoIva: z.string().trim().min(3, 'Obrigatório.').max(200, 'Máximo 200 caracteres.'),
  valorHora: z.coerce.number({ error: 'Valor inválido.' }).positive('Tem de ser maior que zero.'),
  validadeOrcamentoDias: z.coerce.number({ error: 'Valor inválido.' }).int('Número inteiro.').min(1, 'Mínimo 1 dia.').max(90, 'Máximo 90 dias.'),
  condicoes: z.object({
    pecasAceitacaoPct: pct,
    maoObraAceitacaoPct: pct,
    parqueamentoDia: numero('Não pode ser negativo.'),
    diasUteisLevantamento: z.coerce.number({ error: 'Valor inválido.' }).int('Número inteiro.').min(0, 'Não pode ser negativo.').max(60, 'Máximo 60.'),
  }),
  garantiaPecasMeses: numero('Não pode ser negativo.').int('Número inteiro.'),
  garantiaMaoObraMeses: numero('Não pode ser negativo.').int('Número inteiro.'),
  capacidadeDiaria: z.coerce.number({ error: 'Valor inválido.' }).int('Número inteiro.').min(1, 'Mínimo 1.').max(100, 'Máximo 100.'),
  descontoMaximoPct: z.coerce.number({ error: 'Valor inválido.' }).min(0, 'Não pode ser negativo.').max(100, 'Máximo 100%.'),
});
type EntradaConfig = z.input<typeof esquemaConfig>;

function EmpresaPrecos() {
  const { data, isPending, error, refetch } = useConfiguracao();
  if (isPending) return <Carregando />;
  if (error) return <ErroCarregamento erro={error} onRepetir={refetch} />;
  return <FormConfig inicial={data} />;
}

function FormConfig({ inicial }: { inicial: Configuracao }) {
  const toast = useToast();
  const guardar = useGuardarConfiguracao();
  const { register, handleSubmit, reset, control, formState: { errors, isDirty } } = useForm<EntradaConfig, unknown, Configuracao>({
    resolver: zodResolver(esquemaConfig),
    defaultValues: inicial,
  });
  const contas = useFieldArray({ control, name: 'coordenadasPagamento' });
  const c = useWatch({ control, name: 'condicoes' });
  const resumo = textoCondicoes({
    pecasAceitacaoPct: Number(c?.pecasAceitacaoPct) || 0, maoObraAceitacaoPct: Number(c?.maoObraAceitacaoPct) || 0,
    parqueamentoDia: Number(c?.parqueamentoDia) || 0, diasUteisLevantamento: Number(c?.diasUteisLevantamento) || 0,
  });

  const submeter = handleSubmit((dados) =>
    guardar.mutate(dados, {
      onSuccess: (c) => {
        reset(c);
        toast('Definições guardadas');
      },
      onError: (e) => toast(mensagemErro(e), 'erro'),
    })
  );

  return (
    <form onSubmit={submeter} noValidate className="space-y-4">
      <Card>
        <CardHeader title="Dados da empresa" subtitle="Aparecem no cabeçalho de todos os documentos" />
        <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2">
          <Field label="Nome comercial" erro={errors.empresa?.nome?.message}>{(a) => <Input {...a} {...register('empresa.nome')} />}</Field>
          <Field label="NIF" erro={errors.empresa?.nif?.message}>{(a) => <Input {...a} {...register('empresa.nif')} className="num" />}</Field>
          <Field label="Morada" erro={errors.empresa?.morada?.message}>{(a) => <Input {...a} {...register('empresa.morada')} />}</Field>
          <Field label="Telefone" erro={errors.empresa?.telefone?.message}>{(a) => <Input {...a} {...register('empresa.telefone')} className="num" />}</Field>
          <Field label="Email" erro={errors.empresa?.email?.message}>{(a) => <Input {...a} {...register('empresa.email')} type="email" />}</Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Coordenadas de pagamento"
          subtitle="Contas para transferência. Aparecem na pró-forma, nas faturas e no portal do cliente."
          action={contas.fields.length < 5 && (
            <Button type="button" variante="secundario" tamanho="sm" icone={<Plus size={14} />} onClick={() => contas.append({ id: `cb${Date.now().toString(36)}`, banco: '', titular: inicial.empresa.nome, iban: 'AO06 ', conta: '' })}>
              Adicionar conta
            </Button>
          )}
        />
        <div className="space-y-3 px-5 py-4">
          {contas.fields.length === 0 && <p className="text-sm text-sinal-ambar">Sem contas: a pró-forma e as faturas saem sem coordenadas de pagamento.</p>}
          {contas.fields.map((f, i) => {
            const e = errors.coordenadasPagamento?.[i];
            return (
              <fieldset key={f.id} className="grid grid-cols-1 gap-3 rounded-md border border-linha bg-white p-3 sm:grid-cols-12">
                <legend className="sr-only">Conta {i + 1}</legend>
                <Field label="Banco" erro={e?.banco?.message} className="sm:col-span-6">{(a) => <Input {...a} {...register(`coordenadasPagamento.${i}.banco`)} placeholder="BAI" />}</Field>
                <Field label="Titular" erro={e?.titular?.message} className="sm:col-span-6">{(a) => <Input {...a} {...register(`coordenadasPagamento.${i}.titular`)} />}</Field>
                <Field label="IBAN" erro={e?.iban?.message} className="sm:col-span-7">{(a) => <Input {...a} {...register(`coordenadasPagamento.${i}.iban`)} className="num uppercase" placeholder="AO06 0000 0000 0000 0000 0000 0" />}</Field>
                <Field label="Nº de conta" hint="Opcional" className="sm:col-span-3">{(a) => <Input {...a} {...register(`coordenadasPagamento.${i}.conta`)} className="num" />}</Field>
                <div className="flex items-start sm:col-span-2 sm:pt-6">
                  <Button type="button" variante="fantasma" tamanho="sm" icone={<Trash2 size={14} />} onClick={() => contas.remove(i)} aria-label={`Remover a conta ${i + 1}`}>Remover</Button>
                </div>
              </fieldset>
            );
          })}
          <Field label="Instruções para quem paga" hint="Opcional — sai por baixo das contas" erro={errors.instrucoesPagamento?.message}>
            {(a) => <Textarea {...a} rows={2} {...register('instrucoesPagamento')} placeholder="Ex.: indique o nº do processo no descritivo e envie o comprovativo por WhatsApp." />}
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Condições comerciais" subtitle="Aplicam-se aos orçamentos guardados a partir de agora; os já enviados mantêm as condições da altura" />
        <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-3">
          <Field label="Peças pagas na aceitação (%)" erro={errors.condicoes?.pecasAceitacaoPct?.message}>{(a) => <Input {...a} {...register('condicoes.pecasAceitacaoPct')} type="number" className="num" />}</Field>
          <Field label="Mão de obra paga na aceitação (%)" hint="O resto paga-se no levantamento" erro={errors.condicoes?.maoObraAceitacaoPct?.message}>{(a) => <Input {...a} {...register('condicoes.maoObraAceitacaoPct')} type="number" className="num" />}</Field>
          <Field label="Prazo para aceitar o orçamento (dias)" hint="Depois disto conta parqueamento" erro={errors.validadeOrcamentoDias?.message}>{(a) => <Input {...a} {...register('validadeOrcamentoDias')} type="number" className="num" />}</Field>
          <Field label="Parqueamento (Kz por dia)" hint="Sem IVA; o IVA segue o regime do orçamento" erro={errors.condicoes?.parqueamentoDia?.message}>{(a) => <Input {...a} {...register('condicoes.parqueamentoDia')} type="number" className="num" />}</Field>
          <Field label="Dias úteis para levantar" hint="Contados a partir do aviso de que a viatura está pronta" erro={errors.condicoes?.diasUteisLevantamento?.message}>{(a) => <Input {...a} {...register('condicoes.diasUteisLevantamento')} type="number" className="num" />}</Field>
          <p className="self-end rounded-md bg-zinc-50 px-3 py-2 text-xs text-mzd-graphite sm:col-span-3">Na pró-forma: «{resumo}»</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Preços e regras" subtitle="Aplicam-se a novos orçamentos; os já emitidos mantêm os valores da altura" />
        <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-3">
          <Field label="Taxa de IVA (%)" erro={errors.taxaIva?.message}>{(a) => <Input {...a} {...register('taxaIva')} type="number" step="0.01" className="num" />}</Field>
          <Field label="Motivo da isenção (documentos sem IVA)" hint="Texto legal — confirme-o com o contabilista" erro={errors.motivoIsencaoIva?.message} className="sm:col-span-2">{(a) => <Input {...a} {...register('motivoIsencaoIva')} />}</Field>
          <Field label="Mão de obra (Kz/hora)" hint="Sem IVA" erro={errors.valorHora?.message}>{(a) => <Input {...a} {...register('valorHora')} type="number" className="num" />}</Field>
          <Field label="Garantia de peças (meses)" erro={errors.garantiaPecasMeses?.message}>{(a) => <Input {...a} {...register('garantiaPecasMeses')} type="number" className="num" />}</Field>
          <Field label="Garantia de mão de obra (meses)" erro={errors.garantiaMaoObraMeses?.message}>{(a) => <Input {...a} {...register('garantiaMaoObraMeses')} type="number" className="num" />}</Field>
          <Field label="Desconto sem aprovação (%)" hint="Acima disto, o desconto precisa da aprovação da Direção" erro={errors.descontoMaximoPct?.message}>{(a) => <Input {...a} {...register('descontoMaximoPct')} type="number" step="0.5" className="num" />}</Field>
          <Field label="Capacidade (entradas por dia)" hint="A agenda avisa quando as marcações ultrapassam este número" erro={errors.capacidadeDiaria?.message}>{(a) => <Input {...a} {...register('capacidadeDiaria')} type="number" className="num" />}</Field>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {isDirty && <span className="text-xs text-mzd-gray">Tem alterações por guardar</span>}
        <Button type="submit" disabled={!isDirty} carregando={guardar.isPending} icone={<Check size={15} />}>Guardar alterações</Button>
      </div>
    </form>
  );
}

// ---------- Modelos ----------

function Modelos() {
  return (
    <Card>
      <CardHeader title="Modelos" subtitle="Os documentos oficiais do processo. Pré-visualize-os no separador Documentos de qualquer processo; a ficha de entrada e a pró-forma imprimem-se a partir do painel «Próximo passo»." />
      <ol className="divide-y divide-linha/70">
        {['Ficha de Entrada (em papel, assinada e digitalizada)', 'Documento de Diagnóstico', 'Orçamento / Fatura Pró-forma (com coordenadas e espaço para o cliente assinar)', 'Declaração de Autorização', 'Checklist de Qualidade', 'Relatório de Serviços', 'Fatura / Recibo + Termo de Garantia', 'Fatura de Parqueamento'].map((d, i) => (
          <li key={d} className="flex items-center gap-3 px-5 py-3 text-[13.5px]">
            <span className="num w-5 text-right text-xs text-mzd-gray">{i + 1}</span>
            <span className="font-medium text-mzd-black">{d}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
