import { Phone, Mail } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import { ESTADOS_ORDEM, ESTADO_LABEL } from '../types';

const DESCRICAO_ETAPA: Record<string, string> = {
  recepcao: 'Registo da viatura, queixa do cliente, estado de entrada e assinatura.',
  diagnostico: 'O mecânico inspeciona cada sistema e regista o parecer técnico.',
  orcamentacao: 'Peças e mão de obra são orçamentadas com base no diagnóstico.',
  aguarda_aprovacao: 'O cliente aprova o diagnóstico e o orçamento num único passo.',
  em_reparacao: 'Execução dos trabalhos aprovados; pode parar à espera de peças.',
  controlo_qualidade: 'O chefe de oficina verifica o trabalho e os itens de segurança.',
  pronta_entrega: 'Fatura emitida; o cliente é avisado para levantar a viatura.',
  entregue: 'Pagamento concluído e viatura entregue com o termo de garantia.',
};

export default function Ajuda() {
  return (
    <div className="pagina space-y-5">
      <PageHeader titulo="Ajuda" descricao="Como funciona o percurso de um processo e a quem pedir apoio" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="O percurso de uma viatura" subtitle="Cada etapa só avança quando a anterior está completa" />
          <ol className="divide-y divide-linha/70">
            {ESTADOS_ORDEM.map((e, i) => (
              <li key={e} className="flex gap-4 px-5 py-3">
                <span className="num w-6 shrink-0 pt-px text-xs text-mzd-gray">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <p className="text-[13.5px] font-semibold text-mzd-black">{ESTADO_LABEL[e]}</p>
                  <p className="text-[13px] text-mzd-gray">{DESCRICAO_ETAPA[e]}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="self-start">
          <CardHeader title="Suporte" subtitle="Segunda a sábado, 08h–18h" />
          <div className="space-y-3 px-5 py-4 text-sm">
            <a href="tel:+244923000000" className="flex items-center gap-2.5 text-mzd-black hover:underline"><Phone size={15} /> <span className="num">+244 923 000 000</span></a>
            <a href="mailto:suporte@mzdcarros.ao" className="flex items-center gap-2.5 text-mzd-black hover:underline"><Mail size={15} /> suporte@mzdcarros.ao</a>
          </div>
        </Card>
      </div>
    </div>
  );
}
