import { useState } from 'react';
import { Download } from 'lucide-react';
import clsx from 'clsx';
import { useAuditoria, useUtilizadores } from '../../api/hooks';
import { api } from '../../api/endpoints';
import type { FiltrosAuditoria } from '../../api/endpoints';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Form';
import { SearchInput } from '../../components/ui/Controls';
import { Table, Th, Tr, Td, LinhaVazia } from '../../components/ui/Table';
import { ErroCarregamento } from '../../components/ui/Estados';
import { useToast } from '../../components/ui/toast-context';
import { formatDateTime } from '../../lib/format';
import { diaISO } from '../../lib/datas';
import { descarregarCsv } from '../../lib/csv';
import { mensagemErro } from '../../lib/erros';
import { ACOES_SENSIVEIS, acaoLegivel, ENTIDADE_LABEL, entidadeLegivel } from '../../lib/auditoria';

const TAMANHO = 50;

/** Quem fez o quê e quando, com filtros e exportação. Só leitura: o registo não se altera. */
export default function Auditoria() {
  const toast = useToast();
  const [inicio] = useState(() => diaISO(new Date(Date.now() - 29 * 86400000)));
  const [f, setF] = useState<FiltrosAuditoria>({ de: inicio, ate: diaISO(new Date()), pagina: 1 });
  const { data, error, refetch, isFetching } = useAuditoria({ ...f, tamanho: TAMANHO });
  const { data: utilizadores = [] } = useUtilizadores();
  const nome = (id: string | null) => (id ? utilizadores.find((u) => u.id === id)?.nome ?? id : 'Cliente / sistema');
  const mudar = (p: Partial<FiltrosAuditoria>) => setF({ ...f, ...p, pagina: 1 });
  const paginas = data ? Math.max(1, Math.ceil(data.total / TAMANHO)) : 1;

  async function exportar() {
    try {
      const tudo = await api.auditoria.listar({ ...f, pagina: 1, tamanho: 5000 });
      descarregarCsv(`mzd-auditoria-${f.de ?? 'inicio'}-a-${f.ate ?? 'hoje'}`, ['Data', 'Utilizador', 'Ação', 'Entidade', 'Referência', 'Detalhe'],
        tudo.itens.map((a) => [formatDateTime(a.data), nome(a.utilizadorId), acaoLegivel(a.acao), entidadeLegivel(a.entidade), a.entidadeId, a.detalhe]));
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" aria-label="Desde" value={f.de ?? ''} max={f.ate} onChange={(e) => mudar({ de: e.target.value || undefined })} className="!h-9 w-40" />
        <span className="text-xs text-mzd-gray">até</span>
        <Input type="date" aria-label="Até" value={f.ate ?? ''} min={f.de} onChange={(e) => mudar({ ate: e.target.value || undefined })} className="!h-9 w-40" />
        <Select aria-label="Utilizador" value={f.utilizadorId ?? ''} onChange={(e) => mudar({ utilizadorId: e.target.value || undefined })} className="!h-9 w-48">
          <option value="">Todos os utilizadores</option>
          <option value="sistema">Cliente / sistema</option>
          {utilizadores.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </Select>
        <Select aria-label="Área" value={f.entidade ?? ''} onChange={(e) => mudar({ entidade: e.target.value || undefined })} className="!h-9 w-44">
          <option value="">Todas as áreas</option>
          {Object.entries(ENTIDADE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <SearchInput value={f.q ?? ''} onChange={(v) => mudar({ q: v || undefined })} placeholder="Nº de processo, email, detalhe…" label="Pesquisar na auditoria" className="!max-w-xs" />
        <Button variante="secundario" tamanho="sm" icone={<Download size={13} />} onClick={exportar} className="ml-auto">CSV</Button>
      </div>
      {error ? <ErroCarregamento erro={error} onRepetir={refetch} /> : (
        <Card className={clsx(isFetching && 'opacity-70')}>
          <Table>
            <thead><tr><Th>Data</Th><Th>Quem</Th><Th>O quê</Th><Th>Detalhe</Th></tr></thead>
            <tbody>
              {data?.itens.map((a) => (
                <Tr key={a.id}>
                  <Td num className="whitespace-nowrap text-mzd-gray">{formatDateTime(a.data)}</Td>
                  <Td className="whitespace-nowrap text-mzd-black">{nome(a.utilizadorId)}</Td>
                  <Td>
                    <span className={clsx('font-medium', ACOES_SENSIVEIS.has(a.acao) ? 'text-sinal-vermelho' : 'text-mzd-black')}>{acaoLegivel(a.acao)}</span>
                    <span className="text-mzd-gray"> · {entidadeLegivel(a.entidade)}</span>
                    {a.entidadeId && <span className="num ml-1 text-xs text-zinc-400">{a.entidadeId}</span>}
                  </Td>
                  <Td className="text-mzd-gray">{a.detalhe ?? '—'}</Td>
                </Tr>
              ))}
              {data && data.itens.length === 0 && <LinhaVazia colunas={4}>Nenhum evento com estes filtros.</LinhaVazia>}
            </tbody>
          </Table>
        </Card>
      )}
      {data && (
        <div className="flex items-center justify-between text-xs text-mzd-gray">
          <span className="num">{data.total.toLocaleString('pt-PT')} evento(s)</span>
          {paginas > 1 && (
            <div className="flex items-center gap-2">
              <Button variante="secundario" tamanho="sm" disabled={(f.pagina ?? 1) <= 1} onClick={() => setF({ ...f, pagina: (f.pagina ?? 1) - 1 })}>Anterior</Button>
              <span className="num">página {f.pagina} de {paginas}</span>
              <Button variante="secundario" tamanho="sm" disabled={(f.pagina ?? 1) >= paginas} onClick={() => setF({ ...f, pagina: (f.pagina ?? 1) + 1 })}>Seguinte</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
