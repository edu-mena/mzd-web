import { useAuth } from '../auth/useAuth';
import { useProcessos } from '../api/hooks';
import PageHeader from '../components/ui/PageHeader';
import Tabs from '../components/ui/Tabs';
import Faturas from './financeiro/Faturas';
import Caixa from './financeiro/Caixa';
import Dividas from './financeiro/Dividas';
import Descontos from './financeiro/Descontos';

export default function Faturacao() {
  const { can } = useAuth();
  const { data: processos = [] } = useProcessos();
  const pendentes = processos.filter((p) => p.orcamento?.desconto?.estado === 'pendente').length;
  return (
    <div className="pagina space-y-5">
      <PageHeader titulo="Financeiro" descricao="Faturas, caixa diária, dívidas de clientes e descontos · valores com IVA" />
      <Tabs
        tabs={[
          { id: 'faturas', label: 'Faturas', content: <Faturas /> },
          { id: 'caixa', label: 'Caixa', content: <Caixa /> },
          { id: 'dividas', label: 'Dívidas', content: <Dividas /> },
          ...(can('financeiro.supervisionar') ? [{ id: 'descontos', label: 'Descontos', badge: pendentes, content: <Descontos /> }] : []),
        ]}
      />
    </div>
  );
}
