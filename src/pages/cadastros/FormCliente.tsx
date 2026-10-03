import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAlterarCadastro } from '../../api/hooks';
import { api } from '../../api/endpoints';
import type { DadosCliente } from '../../api/endpoints';
import type { Cliente } from '../../types';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import { Checkbox, Field, Input } from '../../components/ui/Form';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';

const opcional = z.string().trim().optional().transform((v) => v || undefined);

const esquema = z.object({
  nome: z.string().trim().min(3, 'Indique o nome completo.'),
  telefone: z.string().trim().refine((v) => v.replace(/\D/g, '').length >= 9, 'Telefone inválido (mínimo 9 dígitos).'),
  email: opcional.refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), 'Email inválido.'),
  nif: opcional,
  morada: opcional,
  consentimentoMensagens: z.boolean(),
});
type Entrada = z.input<typeof esquema>;

/** Criar ou editar um cliente. */
export default function FormCliente({
  cliente,
  onFechar,
  onGuardado,
}: {
  cliente?: Cliente;
  onFechar: () => void;
  onGuardado?: (c: Cliente) => void;
}) {
  const toast = useToast();
  const alterar = useAlterarCadastro<Cliente>();
  const { register, control, handleSubmit, formState: { errors, isDirty } } = useForm<Entrada, unknown, DadosCliente>({
    resolver: zodResolver(esquema),
    defaultValues: {
      nome: cliente?.nome ?? '',
      telefone: cliente?.telefone ?? '+244 ',
      email: cliente?.email ?? '',
      nif: cliente?.nif ?? '',
      morada: cliente?.morada ?? '',
      consentimentoMensagens: cliente?.consentimentoMensagens ?? true,
    },
  });

  const submeter = handleSubmit((dados) =>
    alterar.mutate(() => (cliente ? api.clientes.editar(cliente.id, dados) : api.clientes.criar(dados)), {
      onSuccess: (c) => {
        toast(cliente ? 'Cliente atualizado' : `Cliente ${c.nome} registado`);
        onGuardado?.(c);
        onFechar();
      },
      onError: (e) => toast(mensagemErro(e), 'erro'),
    })
  );

  return (
    <Drawer
      open
      onClose={onFechar}
      titulo={cliente ? 'Editar cliente' : 'Novo cliente'}
      rodape={
        <>
          <Button variante="fantasma" onClick={onFechar}>Cancelar</Button>
          <Button onClick={submeter} carregando={alterar.isPending} disabled={!!cliente && !isDirty}>{cliente ? 'Guardar alterações' : 'Registar cliente'}</Button>
        </>
      }
    >
      <form onSubmit={submeter} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nome completo" erro={errors.nome?.message} className="sm:col-span-2">{(a) => <Input {...a} {...register('nome')} autoFocus />}</Field>
        <Field label="Telefone (WhatsApp)" erro={errors.telefone?.message}>{(a) => <Input {...a} {...register('telefone')} inputMode="tel" className="num" />}</Field>
        <Field label="Email" hint="Opcional" erro={errors.email?.message}>{(a) => <Input {...a} {...register('email')} type="email" />}</Field>
        <Field label="NIF" hint="Opcional — necessário para faturas com NIF" erro={errors.nif?.message}>{(a) => <Input {...a} {...register('nif')} className="num uppercase" />}</Field>
        <Field label="Morada" hint="Opcional">{(a) => <Input {...a} {...register('morada')} />}</Field>
        <Controller
          control={control}
          name="consentimentoMensagens"
          render={({ field }) => (
            <Checkbox checked={field.value} onChange={field.onChange} className="sm:col-span-2">
              Aceita receber mensagens por WhatsApp e email sobre a viatura
              <span className="block text-xs text-mzd-gray">Lei n.º 22/11 de Proteção de Dados Pessoais. A alteração fica registada na auditoria.</span>
            </Checkbox>
          )}
        />
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}
