import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, RotateCcw } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Tabs from '../components/ui/Tabs';
import { Field, Input } from '../components/ui/Form';
import { Table, Th, Tr, Td, LinhaVazia } from '../components/ui/Table';
import { Carregando, ErroCarregamento } from '../components/ui/Estados';
import { useToast } from '../components/ui/toast-context';
import { chaves, trocarSessao, useConfiguracao, useGuardarConfiguracao, useUtilizadores } from '../api/hooks';
import { api } from '../api/endpoints';
import { API_MODE } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { PERMISSAO_LABEL, PERMISSOES_POR_PERFIL } from '../auth/permissions';
import type { Permissao } from '../auth/permissions';
import { PERFIL_LABEL } from '../types';
import type { Configuracao, Perfil } from '../types';
import { formatDateTime } from '../lib/format';
import { mensagemErro } from '../lib/erros';

export default function Definicoes() {
  const { can } = useAuth();
  return (
    <div className="pagina space-y-5">
      <PageHeader titulo="Definições" descricao="Dados da empresa, preços-base, utilizadores e permissões" />
      <Tabs
        tabs={[
          { id: 'empresa', label: 'Empresa e preços', content: <EmpresaPrecos /> },
          { id: 'utilizadores', label: 'Utilizadores e permissões', content: <Utilizadores /> },
          { id: 'modelos', label: 'Modelos de documentos', content: <Modelos /> },
          ...(can('sistema.admin') ? [{ id: 'sistema', label: 'Sistema', content: <Sistema /> }] : []),
        ]}
      />
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

// ---------- Utilizadores & Permissões ----------

const PERFIS = Object.keys(PERFIL_LABEL) as Perfil[];

function Utilizadores() {
  const { data: utilizadores, isPending, error, refetch } = useUtilizadores();
  if (isPending) return <Carregando />;
  if (error) return <ErroCarregamento erro={error} onRepetir={refetch} />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Utilizadores" subtitle="A criação e edição de utilizadores chega com a área de administração" />
        <Table>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th>Email</Th>
              <Th>Perfil</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {utilizadores.map((u) => (
              <Tr key={u.id}>
                <Td className="font-semibold text-mzd-black">{u.nome}</Td>
                <Td className="text-mzd-gray">{u.email}</Td>
                <Td className="text-mzd-gray">{PERFIL_LABEL[u.perfil]}</Td>
                <Td><span className={`rotulo ${u.ativo ? '!text-sinal-verde' : ''}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader title="Matriz de permissões" subtitle="O que cada perfil pode fazer. O servidor aplica as mesmas regras em cada pedido." />
        <Table>
          <thead>
            <tr>
              <Th className="sticky left-0 z-10 bg-white">Permissão</Th>
              {PERFIS.map((p) => <Th key={p} className="text-center">{PERFIL_LABEL[p]}</Th>)}
            </tr>
          </thead>
          <tbody>
            {(Object.keys(PERMISSAO_LABEL) as Permissao[]).map((perm) => (
              <Tr key={perm}>
                <Td className="sticky left-0 bg-white text-mzd-black">{PERMISSAO_LABEL[perm]}</Td>
                {PERFIS.map((p) => (
                  <Td key={p} className="text-center">
                    {PERMISSOES_POR_PERFIL[p].includes(perm)
                      ? <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-mzd-black" role="img" aria-label="Sim" />
                      : <span className="inline-block h-2.5 w-2.5 rounded-[2px] border border-zinc-300" role="img" aria-label="Não" />}
                  </Td>
                ))}
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
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

// ---------- Sistema (administrador) ----------

function Sistema() {
  const toast = useToast();
  const qc = useQueryClient();
  const { data: auditoria, isPending, error, refetch } = useQuery({ queryKey: chaves.auditoria, queryFn: api.auditoria.listar });
  const { data: utilizadores = [] } = useUtilizadores();
  const nome = (id: string | null) => (id ? utilizadores.find((u) => u.id === id)?.nome ?? id : 'Desconhecido');

  async function reporDemo() {
    if (!window.confirm('Repor todos os dados de demonstração? Todas as alterações feitas neste navegador serão perdidas e terá de iniciar sessão novamente.')) return;
    try {
      await api.demo.repor();
      trocarSessao(qc, null);
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Registo de auditoria" subtitle="Últimos 50 eventos: entradas, alterações e operações sensíveis" />
        {isPending ? (
          <div className="p-5"><Carregando /></div>
        ) : error ? (
          <ErroCarregamento erro={error} onRepetir={refetch} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Utilizador</Th>
                <Th>Ação</Th>
                <Th>Detalhe</Th>
              </tr>
            </thead>
            <tbody>
              {auditoria.slice(0, 50).map((a) => (
                <Tr key={a.id}>
                  <Td num className="whitespace-nowrap text-mzd-gray">{formatDateTime(a.data)}</Td>
                  <Td className="text-mzd-black">{nome(a.utilizadorId)}</Td>
                  <Td num className={`text-xs ${a.acao === 'login_falhado' ? 'text-sinal-vermelho' : 'text-mzd-black'}`}>
                    {a.acao} · {a.entidade}{a.entidadeId ? ` ${a.entidadeId}` : ''}
                  </Td>
                  <Td className="text-mzd-gray">{a.detalhe ?? '—'}</Td>
                </Tr>
              ))}
              {auditoria.length === 0 && <LinhaVazia colunas={4}>Sem eventos registados.</LinhaVazia>}
            </tbody>
          </Table>
        )}
      </Card>

      {API_MODE === 'mock' && (
        <Card>
          <CardHeader title="Dados de demonstração" subtitle="Disponível apenas no modo de demonstração (sem servidor)" />
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <p className="text-sm text-mzd-gray">Repõe clientes, viaturas e processos de exemplo e termina a sessão.</p>
            <Button variante="secundario" icone={<RotateCcw size={14} />} onClick={reporDemo}>Repor dados</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
