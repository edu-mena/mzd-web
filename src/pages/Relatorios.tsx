import { useSearchParams } from 'react-router-dom';
import { useRelatorio } from '../api/hooks';
import { useAuth } from '../auth/useAuth';
import PageHeader from '../components/ui/PageHeader';
import Tabs from '../components/ui/Tabs';
import { Segmented } from '../components/ui/Controls';
import { Input } from '../components/ui/Form';
import { Carregando, ErroCarregamento } from '../components/ui/Estados';
import { dataCurta, intervaloDe, PERIODOS } from '../lib/periodos';
import type { IdPeriodo } from '../lib/periodos';
import { Clientes, Equipa, Negocio, Operacao } from './relatorios/Seccoes';

const DIA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Relatórios por período, comparados com o período anterior de igual duração. O período fica no endereço. */
export default function Relatorios() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const de0 = params.get('de') ?? '';
  const ate0 = params.get('ate') ?? '';
  const personalizado = DIA_ISO.test(de0) && DIA_ISO.test(ate0) && de0 <= ate0;
  const id = (PERIODOS.some((p) => p.id === params.get('p')) ? params.get('p') : 'mes') as IdPeriodo;
  const { de, ate } = personalizado ? { de: de0, ate: ate0 } : intervaloDe(id);
  const { data: r, error, refetch, isFetching } = useRelatorio(de, ate);

  const escolher = (p: IdPeriodo | 'personalizado') => {
    if (p === 'personalizado') setParams({ de, ate }, { replace: true });
    else setParams({ p }, { replace: true });
  };
  const mudarData = (campo: 'de' | 'ate', v: string) => {
    if (!DIA_ISO.test(v)) return;
    const novo = { de, ate, [campo]: v };
    if (novo.de <= novo.ate) setParams(novo, { replace: true });
  };

  return (
    <div className="pagina space-y-5">
      <PageHeader titulo="Relatórios" descricao="Indicadores do período escolhido, comparados com o período anterior de igual duração" />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented<IdPeriodo | 'personalizado'>
          label="Período"
          value={personalizado ? 'personalizado' : id}
          onChange={escolher}
          opcoes={[...PERIODOS.map((p) => ({ valor: p.id, label: p.label })), { valor: 'personalizado' as const, label: 'Outro' }]}
        />
        {personalizado && (
          <div className="flex items-center gap-2">
            <Input type="date" aria-label="Desde" value={de} max={ate} onChange={(e) => mudarData('de', e.target.value)} className="!h-9 w-40" />
            <span className="text-xs text-mzd-gray">até</span>
            <Input type="date" aria-label="Até" value={ate} min={de} onChange={(e) => mudarData('ate', e.target.value)} className="!h-9 w-40" />
          </div>
        )}
        <p className="num ml-auto text-xs text-mzd-gray" aria-live="polite">
          {dataCurta(de)} – {dataCurta(ate)}
          {r && <> · antes: {dataCurta(r.periodo.anteriorDe)} – {dataCurta(r.periodo.anteriorAte)}</>}
          {isFetching && ' · a atualizar…'}
        </p>
      </div>

      {error ? <ErroCarregamento erro={error} onRepetir={refetch} /> : !r ? <Carregando /> : (
        <div className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <Tabs
            tabs={[
              ...(r.negocio && can('valores.ver') ? [{ id: 'negocio', label: 'Negócio', content: <Negocio r={r} /> }] : []),
              { id: 'operacao', label: 'Operação', content: <Operacao r={r} /> },
              { id: 'equipa', label: 'Equipa', content: <Equipa r={r} /> },
              { id: 'clientes', label: 'Clientes e serviços', content: <Clientes r={r} /> },
            ]}
          />
        </div>
      )}
    </div>
  );
}
