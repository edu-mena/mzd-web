import { useState } from 'react';
import { Copy, KeyRound, Pencil, Plus, Power } from 'lucide-react';
import clsx from 'clsx';
import { useAlterarUtilizador, useUtilizadores } from '../../api/hooks';
import { api } from '../../api/endpoints';
import type { DadosUtilizador } from '../../api/endpoints';
import { useAuth } from '../../auth/useAuth';
import { PERFIL_LABEL } from '../../types';
import type { Perfil, Utilizador } from '../../types';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Drawer from '../../components/ui/Drawer';
import Modal from '../../components/ui/Modal';
import { Field, Input, Select } from '../../components/ui/Form';
import { Aviso } from '../../components/ui/Controls';
import { Table, Th, Tr, Td } from '../../components/ui/Table';
import { Carregando, ErroCarregamento } from '../../components/ui/Estados';
import { useToast } from '../../components/ui/toast-context';
import { mensagemErro } from '../../lib/erros';
import { haQuanto } from '../../lib/datas';

const ORDEM: Perfil[] = ['direcao', 'chefe_oficina', 'mecanico', 'rececionista', 'administrativa', 'admin'];

export default function Utilizadores() {
  const { user, can } = useAuth();
  const { data: utilizadores, isPending, error, refetch } = useUtilizadores();
  const [agora] = useState(() => Date.now());
  const [editar, setEditar] = useState<Utilizador | 'novo' | null>(null);
  const [senha, setSenha] = useState<{ nome: string; senha: string; nova: boolean } | null>(null);
  const [confirmar, setConfirmar] = useState<{ u: Utilizador; acao: 'senha' | 'desativar' } | null>(null);
  const alterar = useAlterarUtilizador<unknown>();
  const toast = useToast();

  if (isPending) return <Carregando />;
  if (error) return <ErroCarregamento erro={error} onRepetir={refetch} />;
  const admin = can('sistema.admin');
  const podeGerir = (u: Utilizador) => admin || u.perfil !== 'admin';
  const ordenados = [...utilizadores].sort((a, b) => Number(b.ativo) - Number(a.ativo) || ORDEM.indexOf(a.perfil) - ORDEM.indexOf(b.perfil) || a.nome.localeCompare(b.nome));

  function executar() {
    if (!confirmar) return;
    const { u, acao } = confirmar;
    if (acao === 'senha') {
      alterar.mutate(() => api.utilizadores.reporSenha(u.id), {
        onSuccess: (r) => { setConfirmar(null); setSenha({ nome: u.nome, senha: (r as { senhaTemporaria: string }).senhaTemporaria, nova: false }); },
        onError: (e) => toast(mensagemErro(e), 'erro'),
      });
    } else {
      alterar.mutate(() => api.utilizadores.definirAtivo(u.id, !u.ativo), {
        onSuccess: () => { setConfirmar(null); toast(u.ativo ? `${u.nome} desativado` : `${u.nome} reativado`); },
        onError: (e) => { setConfirmar(null); toast(mensagemErro(e), 'erro'); },
      });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-mzd-gray">
          As contas não se apagam: desativam-se, e o histórico continua a mostrar quem fez o quê. Contas novas recebem uma palavra-passe temporária, que a pessoa muda no primeiro acesso.
        </p>
        <Button icone={<Plus size={15} />} onClick={() => setEditar('novo')}>Novo utilizador</Button>
      </div>
      <Card>
        <Table>
          <thead><tr><Th>Nome</Th><Th>Perfil</Th><Th>Último acesso</Th><Th>Estado</Th><Th /></tr></thead>
          <tbody>
            {ordenados.map((u) => (
              <Tr key={u.id} className={clsx(!u.ativo && 'opacity-60')}>
                <Td>
                  <span className="block font-semibold text-mzd-black">{u.nome}{u.id === user?.id && <span className="ml-1.5 text-xs font-normal text-mzd-gray">(você)</span>}</span>
                  <span className="block text-xs text-mzd-gray">{u.email}</span>
                </Td>
                <Td className="text-mzd-black">{PERFIL_LABEL[u.perfil]}</Td>
                <Td className="text-mzd-gray">{u.ultimoAcesso ? haQuanto(u.ultimoAcesso, agora) : 'Nunca entrou'}</Td>
                <Td>
                  <span className={clsx('rotulo', u.ativo ? '!text-sinal-verde' : '')}>{u.ativo ? 'Ativo' : 'Inativo'}</span>
                  {u.mudarSenha && u.ativo && <span className="block text-[11px] text-sinal-ambar">Senha temporária por mudar</span>}
                </Td>
                <Td direita>
                  {podeGerir(u) && (
                    <div className="flex justify-end gap-1">
                      <Button variante="fantasma" tamanho="sm" icone={<Pencil size={13} />} onClick={() => setEditar(u)} aria-label={`Editar ${u.nome}`}>Editar</Button>
                      {u.id !== user?.id && u.ativo && (
                        <Button variante="fantasma" tamanho="sm" icone={<KeyRound size={13} />} onClick={() => setConfirmar({ u, acao: 'senha' })} aria-label={`Repor a palavra-passe de ${u.nome}`}>Senha</Button>
                      )}
                      {u.id !== user?.id && (
                        <Button variante="fantasma" tamanho="sm" icone={<Power size={13} />} onClick={() => setConfirmar({ u, acao: 'desativar' })}>{u.ativo ? 'Desativar' : 'Reativar'}</Button>
                      )}
                    </div>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {editar && (
        <FormUtilizador
          utilizador={editar === 'novo' ? undefined : editar}
          onFechar={() => setEditar(null)}
          onCriado={(nome, s) => { setEditar(null); setSenha({ nome, senha: s, nova: true }); }}
        />
      )}

      <Modal
        open={!!confirmar}
        onClose={() => setConfirmar(null)}
        title={confirmar?.acao === 'senha' ? 'Repor a palavra-passe?' : confirmar?.u.ativo ? 'Desativar a conta?' : 'Reativar a conta?'}
        footer={
          <>
            <Button variante="fantasma" onClick={() => setConfirmar(null)}>Cancelar</Button>
            <Button variante={confirmar?.acao === 'desativar' && confirmar.u.ativo ? 'perigo' : 'primario'} carregando={alterar.isPending} onClick={executar}>
              {confirmar?.acao === 'senha' ? 'Gerar palavra-passe temporária' : confirmar?.u.ativo ? 'Desativar' : 'Reativar'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-mzd-graphite">
          {confirmar?.acao === 'senha'
            ? `A palavra-passe atual de ${confirmar.u.nome} deixa de funcionar. Vai ver uma palavra-passe temporária para lhe entregar pessoalmente.`
            : confirmar?.u.ativo
              ? `${confirmar?.u.nome} deixa de conseguir entrar e as sessões abertas terminam. O histórico mantém-se.`
              : `${confirmar?.u.nome} volta a poder entrar com a palavra-passe que tinha.`}
        </p>
      </Modal>

      <Modal open={!!senha} onClose={() => setSenha(null)} title={senha?.nova ? 'Conta criada' : 'Palavra-passe reposta'} footer={<Button onClick={() => setSenha(null)}>Já a guardei</Button>}>
        {senha && <SenhaTemporaria nome={senha.nome} senha={senha.senha} />}
      </Modal>
    </div>
  );
}

function SenhaTemporaria({ nome, senha }: { nome: string; senha: string }) {
  const toast = useToast();
  return (
    <div className="space-y-3">
      <p className="text-sm text-mzd-graphite">Palavra-passe temporária de <strong>{nome}</strong>:</p>
      <div className="flex items-center gap-2">
        <code className="num flex-1 rounded-md border border-linha-forte bg-papel px-4 py-3 text-center text-lg font-semibold tracking-wider text-mzd-black">{senha}</code>
        <Button variante="secundario" icone={<Copy size={14} />} onClick={() => navigator.clipboard.writeText(senha).then(() => toast('Copiada'), () => toast('Não foi possível copiar', 'erro'))}>Copiar</Button>
      </div>
      <Aviso tom="neutro">Só aparece agora. Entregue-a pessoalmente (nunca por email); no primeiro acesso, o sistema pede uma palavra-passe nova.</Aviso>
    </div>
  );
}

function FormUtilizador({ utilizador: u, onFechar, onCriado }: { utilizador?: Utilizador; onFechar: () => void; onCriado: (nome: string, senha: string) => void }) {
  const { user, can } = useAuth();
  const toast = useToast();
  const alterar = useAlterarUtilizador<unknown>();
  const [d, setD] = useState<DadosUtilizador>({ nome: u?.nome ?? '', email: u?.email ?? '', telefone: u?.telefone ?? '', perfil: u?.perfil ?? 'rececionista' });
  const perfis = (Object.keys(PERFIL_LABEL) as Perfil[]).filter((p) => p !== 'admin' || can('sistema.admin'));
  const proprio = u?.id === user?.id;

  const guardar = () => alterar.mutate(
    () => (u ? api.utilizadores.editar(u.id, d) : api.utilizadores.criar(d)),
    {
      onSuccess: (r) => {
        if (u) { toast('Utilizador atualizado'); onFechar(); } else onCriado(d.nome, (r as { senhaTemporaria: string }).senhaTemporaria);
      },
      onError: (e) => toast(mensagemErro(e), 'erro'),
    },
  );

  return (
    <Drawer
      open
      onClose={onFechar}
      titulo={u ? 'Editar utilizador' : 'Novo utilizador'}
      rodape={<><Button variante="fantasma" onClick={onFechar}>Cancelar</Button><Button onClick={guardar} carregando={alterar.isPending}>{u ? 'Guardar' : 'Criar conta'}</Button></>}
    >
      <div className="space-y-4">
        <Field label="Nome completo">{(a) => <Input {...a} value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} autoFocus />}</Field>
        <Field label="Email" hint="É o nome de utilizador para entrar">{(a) => <Input {...a} type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />}</Field>
        <Field label="Telefone" hint="Opcional">{(a) => <Input {...a} value={d.telefone} onChange={(e) => setD({ ...d, telefone: e.target.value })} className="num" />}</Field>
        <Field label="Perfil" hint={proprio ? 'Não pode mudar o seu próprio perfil.' : 'Define o que a pessoa pode ver e fazer (ver Permissões).'}>
          {(a) => (
            <Select {...a} value={d.perfil} disabled={proprio} onChange={(e) => setD({ ...d, perfil: e.target.value as Perfil })}>
              {perfis.map((p) => <option key={p} value={p}>{PERFIL_LABEL[p]}</option>)}
            </Select>
          )}
        </Field>
      </div>
    </Drawer>
  );
}
