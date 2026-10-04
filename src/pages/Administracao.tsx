import { useAuth } from '../auth/useAuth';
import { PERMISSAO_LABEL, PERMISSOES_POR_PERFIL } from '../auth/permissions';
import type { Permissao } from '../auth/permissions';
import { PERFIL_LABEL } from '../types';
import type { Perfil } from '../types';
import PageHeader from '../components/ui/PageHeader';
import Tabs from '../components/ui/Tabs';
import { Card, CardHeader } from '../components/ui/Card';
import { Table, Th, Tr, Td } from '../components/ui/Table';
import Utilizadores from './administracao/Utilizadores';
import Auditoria from './administracao/Auditoria';
import { Copias, EstadoDoSistema } from './administracao/Sistema';

export default function Administracao() {
  const { can } = useAuth();
  return (
    <div className="pagina space-y-5">
      <PageHeader titulo="Administração" descricao="Contas da equipa, permissões, registo de auditoria e manutenção do sistema" />
      <Tabs
        tabs={[
          ...(can('utilizadores.gerir') ? [
            { id: 'utilizadores', label: 'Utilizadores', content: <Utilizadores /> },
            { id: 'permissoes', label: 'Permissões', content: <Permissoes /> },
          ] : []),
          { id: 'auditoria', label: 'Auditoria', content: <Auditoria /> },
          ...(can('sistema.admin') ? [
            { id: 'copias', label: 'Cópias de segurança', content: <Copias /> },
            { id: 'sistema', label: 'Estado do sistema', content: <EstadoDoSistema /> },
          ] : []),
        ]}
      />
    </div>
  );
}

const PERFIS = Object.keys(PERFIL_LABEL) as Perfil[];

function Permissoes() {
  return (
    <Card>
      <CardHeader title="O que cada perfil pode fazer" subtitle="O servidor aplica exatamente estas regras em cada pedido. Mudar a matriz é uma alteração ao sistema, feita pelo programador." />
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
  );
}
