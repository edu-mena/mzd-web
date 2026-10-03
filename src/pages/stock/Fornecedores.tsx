import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAlterarStock, useFornecedores, usePecas } from '../../api/hooks';
import { api } from '../../api/endpoints';
import type { Fornecedor } from '../../types';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Drawer from '../../components/ui/Drawer';
import { Checkbox, Field, Input } from '../../components/ui/Form';
import { Table, Th, Tr, Td } from '../../components/ui/Table';
import { Carregando } from '../../components/ui/Estados';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';

export default function Fornecedores() {
  const { data: fornecedores, isPending } = useFornecedores();
  const { data: pecas = [] } = usePecas();
  const [aberto, setAberto] = useState<Fornecedor | 'novo' | null>(null);
  if (isPending || !fornecedores) return <Carregando />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button icone={<Plus size={15} />} onClick={() => setAberto('novo')}>Novo fornecedor</Button></div>
      <Card>
        <Table>
          <thead><tr><Th>Fornecedor</Th><Th>Contacto</Th><Th>NIF</Th><Th direita>Prazo</Th><Th direita>Peças</Th><Th>Estado</Th></tr></thead>
          <tbody>
            {fornecedores.map((f) => (
              <Tr key={f.id} className="cursor-pointer" onClick={() => setAberto(f)}>
                <Td><button type="button" className="font-semibold text-mzd-black hover:underline">{f.nome}</button></Td>
                <Td><span className="num block">{f.telefone ?? '—'}</span>{f.email && <span className="block text-xs text-mzd-gray">{f.email}</span>}</Td>
                <Td num className="text-mzd-gray">{f.nif ?? '—'}</Td>
                <Td direita num>{f.prazoEntregaDias} dia(s)</Td>
                <Td direita num>{pecas.filter((p) => p.fornecedorId === f.id).length}</Td>
                <Td><span className={`rotulo ${f.ativo ? '!text-sinal-verde' : ''}`}>{f.ativo ? 'Ativo' : 'Inativo'}</span></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
      {aberto && <FormFornecedor fornecedor={aberto === 'novo' ? undefined : aberto} onFechar={() => setAberto(null)} />}
    </div>
  );
}

function FormFornecedor({ fornecedor: f, onFechar }: { fornecedor?: Fornecedor; onFechar: () => void }) {
  const toast = useToast();
  const alterar = useAlterarStock<Fornecedor>();
  const [d, setD] = useState({ nome: f?.nome ?? '', telefone: f?.telefone ?? '', email: f?.email ?? '', nif: f?.nif ?? '', prazoEntregaDias: String(f?.prazoEntregaDias ?? 2), ativo: f?.ativo ?? true });
  const dados = { ...d, prazoEntregaDias: Number(d.prazoEntregaDias) };
  return (
    <Drawer
      open
      onClose={onFechar}
      titulo={f ? 'Editar fornecedor' : 'Novo fornecedor'}
      rodape={
        <>
          <Button variante="fantasma" onClick={onFechar}>Cancelar</Button>
          <Button
            carregando={alterar.isPending}
            onClick={() => alterar.mutate(() => (f ? api.fornecedores.editar(f.id, dados) : api.fornecedores.criar(dados)), {
              onSuccess: () => { toast(f ? 'Fornecedor atualizado' : 'Fornecedor registado'); onFechar(); },
              onError: (e) => toast(mensagemErro(e), 'erro'),
            })}
          >
            Guardar
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nome" className="col-span-2">{(a) => <Input {...a} value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} autoFocus />}</Field>
        <Field label="Telefone">{(a) => <Input {...a} value={d.telefone} onChange={(e) => setD({ ...d, telefone: e.target.value })} className="num" />}</Field>
        <Field label="Email">{(a) => <Input {...a} value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} type="email" />}</Field>
        <Field label="NIF">{(a) => <Input {...a} value={d.nif} onChange={(e) => setD({ ...d, nif: e.target.value })} className="num" />}</Field>
        <Field label="Prazo de entrega (dias)" hint="Usado para prever a chegada das encomendas">{(a) => <Input {...a} value={d.prazoEntregaDias} onChange={(e) => setD({ ...d, prazoEntregaDias: e.target.value.replace(/\D/g, '') })} className="num" />}</Field>
        {f && <Checkbox checked={d.ativo} onChange={(v) => setD({ ...d, ativo: v })} className="col-span-2">Fornecedor ativo (inativos não aparecem em novas encomendas)</Checkbox>}
      </div>
    </Drawer>
  );
}
