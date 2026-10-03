import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAlterarCadastro } from '../../api/hooks';
import { api } from '../../api/endpoints';
import type { ViaturaResumo } from '../../types';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Form';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';

const anoMax = new Date().getFullYear() + 1;
const esquema = z.object({
  matricula: z.string().trim().transform((v) => v.toUpperCase()).refine((v) => v.replace(/[^A-Z0-9]/g, '').length >= 5, 'Matrícula inválida.'),
  marca: z.string().trim().min(2, 'Indique a marca.'),
  modelo: z.string().trim().min(1, 'Indique o modelo.'),
  ano: z.coerce.number({ error: 'Ano inválido.' }).int().min(1950, 'Ano inválido.').max(anoMax, 'Ano inválido.'),
  cor: z.string().trim().min(2, 'Indique a cor.'),
  chassi: z.string().trim().transform((v) => v.toUpperCase()),
  km: z.coerce.number({ error: 'Valor inválido.' }).int('Use um número inteiro.').min(0, 'Não pode ser negativo.'),
});
type Entrada = z.input<typeof esquema>;
type Saida = z.output<typeof esquema>;

/** Registar uma viatura de um cliente, ou editar os dados de uma viatura existente. */
export default function FormViatura({
  clienteId,
  viatura,
  onFechar,
  onGuardada,
}: {
  clienteId?: string;
  viatura?: ViaturaResumo;
  onFechar: () => void;
  onGuardada?: (v: ViaturaResumo) => void;
}) {
  const toast = useToast();
  const alterar = useAlterarCadastro<ViaturaResumo>();
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<Entrada, unknown, Saida>({
    resolver: zodResolver(esquema),
    defaultValues: {
      matricula: viatura?.matricula ?? '',
      marca: viatura?.marca ?? '',
      modelo: viatura?.modelo ?? '',
      ano: viatura ? String(viatura.ano) : '',
      cor: viatura?.cor ?? '',
      chassi: viatura?.chassi ?? '',
      km: viatura ? String(viatura.km) : '0',
    },
  });

  const submeter = handleSubmit(({ km, ...dados }) =>
    alterar.mutate(() => (viatura ? api.viaturas.editar(viatura.id, dados) : api.viaturas.criar({ ...dados, clienteId: clienteId!, km })), {
      onSuccess: (v) => {
        toast(viatura ? 'Viatura atualizada' : `Viatura ${v.matricula} registada`);
        onGuardada?.(v);
        onFechar();
      },
      onError: (e) => toast(mensagemErro(e), 'erro'),
    })
  );

  return (
    <Drawer
      open
      onClose={onFechar}
      titulo={viatura ? 'Editar viatura' : 'Nova viatura'}
      subtitulo={viatura ? 'A quilometragem é atualizada automaticamente em cada receção e entrega.' : undefined}
      rodape={
        <>
          <Button variante="fantasma" onClick={onFechar}>Cancelar</Button>
          <Button onClick={submeter} carregando={alterar.isPending} disabled={!!viatura && !isDirty}>{viatura ? 'Guardar alterações' : 'Registar viatura'}</Button>
        </>
      }
    >
      <form onSubmit={submeter} noValidate className="grid grid-cols-2 gap-4">
        <Field label="Matrícula" erro={errors.matricula?.message}>{(a) => <Input {...a} {...register('matricula')} className="num uppercase" autoFocus placeholder="LD-00-00-AA" />}</Field>
        <Field label="Ano" erro={errors.ano?.message}>{(a) => <Input {...a} {...register('ano')} inputMode="numeric" className="num" />}</Field>
        <Field label="Marca" erro={errors.marca?.message}>{(a) => <Input {...a} {...register('marca')} />}</Field>
        <Field label="Modelo" erro={errors.modelo?.message}>{(a) => <Input {...a} {...register('modelo')} />}</Field>
        <Field label="Cor" erro={errors.cor?.message}>{(a) => <Input {...a} {...register('cor')} />}</Field>
        <Field label="Nº de chassi" hint="Opcional">{(a) => <Input {...a} {...register('chassi')} className="num uppercase" />}</Field>
        {!viatura && (
          <Field label="Quilometragem atual" hint="Opcional" erro={errors.km?.message}>{(a) => <Input {...a} {...register('km')} inputMode="numeric" className="num" />}</Field>
        )}
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}
