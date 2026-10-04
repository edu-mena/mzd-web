import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Tabs from '../components/ui/Tabs';
import { Field, Input } from '../components/ui/Form';
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
      <PageHeader titulo="Definições" descricao="Dados da empresa, preços-base e regras da oficina" />
      <Tabs
        tabs={[
          { id: 'empresa', label: 'Empresa e preços', content: <EmpresaPrecos /> },
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
const esquemaConfig = z.object({
  empresa: z.object({
    nome: z.string().trim().min(2, 'Obrigatório.'),
    nif: z.string().trim().min(5, 'NIF inválido.'),
    morada: z.string().trim().min(2, 'Obrigatório.'),
    telefone: z.string().trim().min(6, 'Telefone inválido.'),
    email: z.string().trim().email('Email inválido.'),
    iban: z.string().trim().optional(),
  }),
  taxaIva: numero('Não pode ser negativo.').max(100, 'Máximo 100%.'),
  valorHora: z.coerce.number({ error: 'Valor inválido.' }).positive('Tem de ser maior que zero.'),
  validadeOrcamentoDias: numero('Não pode ser negativo.').int('Número inteiro.'),
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
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<EntradaConfig, unknown, Configuracao>({
    resolver: zodResolver(esquemaConfig),
    defaultValues: inicial,
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
          <Field label="IBAN" hint="Opcional — aparece nas faturas" erro={errors.empresa?.iban?.message}>{(a) => <Input {...a} {...register('empresa.iban')} className="num" />}</Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Preços e regras" subtitle="Aplicam-se a novos orçamentos; os já emitidos mantêm os valores da altura" />
        <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-3">
          <Field label="Taxa de IVA (%)" erro={errors.taxaIva?.message}>{(a) => <Input {...a} {...register('taxaIva')} type="number" step="0.01" className="num" />}</Field>
          <Field label="Mão de obra (Kz/hora)" hint="Sem IVA" erro={errors.valorHora?.message}>{(a) => <Input {...a} {...register('valorHora')} type="number" className="num" />}</Field>
          <Field label="Validade do orçamento (dias)" erro={errors.validadeOrcamentoDias?.message}>{(a) => <Input {...a} {...register('validadeOrcamentoDias')} type="number" className="num" />}</Field>
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
      <CardHeader title="Modelos" subtitle="Os 7 documentos oficiais do processo. Pré-visualize-os no separador Documentos de qualquer processo." />
      <ol className="divide-y divide-linha/70">
        {['Ficha de Receção', 'Documento de Diagnóstico', 'Orçamento / Fatura Pró-forma', 'Declaração de Autorização', 'Checklist de Qualidade', 'Relatório de Serviços', 'Fatura + Termo de Garantia'].map((d, i) => (
          <li key={d} className="flex items-center gap-3 px-5 py-3 text-[13.5px]">
            <span className="num w-5 text-right text-xs text-mzd-gray">{i + 1}</span>
            <span className="font-medium text-mzd-black">{d}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
