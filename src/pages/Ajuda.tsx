import { Mail, Phone } from 'lucide-react';
import { useConfiguracao } from '../api/hooks';
import { useAuth } from '../auth/useAuth';
import { Card, CardHeader } from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import { ESTADOS_ORDEM, ESTADO_LABEL, PERFIL_LABEL } from '../types';
import type { Perfil } from '../types';

const DESCRICAO_ETAPA: Record<string, string> = {
  recepcao: 'Registo da viatura, queixa do cliente, estado de entrada e assinatura.',
  diagnostico: 'O mecânico inspeciona cada sistema e regista o parecer técnico.',
  orcamentacao: 'Peças e mão de obra são orçamentadas com base no diagnóstico.',
  aguarda_aprovacao: 'O cliente aprova o diagnóstico e o orçamento num único passo (na oficina, por mensagem ou no link do portal).',
  em_reparacao: 'Execução dos trabalhos aprovados; pode parar à espera de peças.',
  controlo_qualidade: 'O chefe de oficina verifica o trabalho e os itens de segurança.',
  pronta_entrega: 'Fatura emitida; o cliente é avisado para levantar a viatura.',
  entregue: 'Pagamento concluído e viatura entregue com o termo de garantia.',
};

const GUIAS: Record<Perfil, string[]> = {
  rececao: [
    'Conduz o processo inteiro: os técnicos não usam o sistema, por isso é a receção que regista o que eles fazem.',
    'Receção: "Nova receção" ou "Receção" numa marcação; atribua logo o técnico (Oficina ou no processo).',
    'Diagnóstico: preencha o que o técnico encontrou, com fotografias. Depois o orçamento e o envio ao cliente (WhatsApp, email ou link).',
    'Reparação: marque as tarefas feitas e registe as horas de cada técnico em "Registar horas".',
    'Controlo de qualidade, pagamento, recibo e entrega também são seus. Feche a caixa ao fim do dia.',
    'Descontos acima do limite e reabrir uma caixa fechada pedem a Direção.',
  ],
  rececionista: [
    'O painel mostra as chegadas de hoje, as viaturas prontas e os orçamentos à espera do cliente.',
    'Receção: "Nova receção" ou "Receção" numa marcação. A matrícula é procurada antes de criar cliente novo.',
    'Atribua o mecânico logo na receção, para o diagnóstico começar.',
    'Em Comunicações, "Por avisar" lista quem ainda não foi informado. O link de cada mensagem deixa o cliente acompanhar e aprovar.',
  ],
  administrativa: [
    'Pagamentos e recibos no próprio processo; a caixa do dia em Financeiro → Caixa.',
    'Um pagamento errado anula-se no mesmo dia (com motivo); nunca se apaga.',
    'Feche a caixa ao fim do dia com a contagem do numerário; depois disso só a Direção reabre.',
    'Em Peças & Stock, a sugestão de encomenda junta o que falta por fornecedor.',
  ],
  mecanico: [
    'O painel mostra as suas viaturas, pela ordem em que devem ser feitas.',
    'Use o cronómetro em cada reparação: as horas contam para a eficiência da equipa.',
    'Se faltar uma peça, marque "à espera de peças" com uma nota; a administrativa é avisada.',
    'Fotografe o que encontrar no diagnóstico: o cliente vê as fotografias no link do portal.',
  ],
  chefe_oficina: [
    'O quadro da Oficina mostra a carga de cada mecânico; arraste para reatribuir.',
    'No controlo de qualidade, um item não conforme devolve a viatura à reparação com uma tarefa.',
    'Em Relatórios → Operação vê a etapa onde as viaturas demoram mais.',
  ],
  direcao: [
    '"Pede atenção", no painel, junta o que precisa da sua decisão (descontos, caixas por fechar, atrasos).',
    'Descontos acima do limite definido esperam a sua aprovação em Financeiro → Descontos.',
    'Relatórios por período, comparados com o período anterior, exportáveis para Excel (CSV).',
    'Em Administração: contas da equipa e auditoria de tudo o que é feito no sistema.',
  ],
  admin: [
    'Administração → Cópias de segurança: confirme todos os dias que a cópia automática das 03:00 correu.',
    'Estado do sistema: espaço usado, entradas falhadas e versão no ar.',
    'Só o administrador cria ou altera contas de administrador.',
  ],
};

const DUVIDAS: [string, string][] = [
  ['Esqueci-me da palavra-passe.', 'Peça à Direção para a repor (Administração → Utilizadores → Senha). Recebe uma palavra-passe temporária, que muda no primeiro acesso.'],
  ['Registei um pagamento errado.', 'No processo, anule o pagamento com o motivo (só no próprio dia e com a caixa aberta) e registe o correto.'],
  ['A caixa de hoje já foi fechada.', 'Só a Direção a pode reabrir; a reabertura fica registada na auditoria.'],
  ['O cliente diz que não recebeu o WhatsApp.', 'O sistema abre a mensagem no seu WhatsApp; confirme que carregou em Enviar. Pode reenviar em Comunicações.'],
  ['O link do portal foi parar a outra pessoa.', 'No processo → Comunicações, "Novo link": o anterior deixa de funcionar de imediato.'],
  ['Aparece "Há uma versão nova do sistema".', 'Foi publicada uma atualização; carregue em Recarregar. O que estava guardado não se perde.'],
];

const ATALHOS: [string, string][] = [
  ['Ctrl K  ou  /', 'Pesquisa global (matrícula, cliente, processo, páginas)'],
  ['Tab no início da página', '"Saltar para o conteúdo"'],
  ['Esc', 'Fecha janelas, menus e a pesquisa'],
  ['↑ ↓  Enter', 'Escolher na pesquisa e nos menus'],
];

export default function Ajuda() {
  const { user } = useAuth();
  const { data: config } = useConfiguracao();
  const perfis = (Object.keys(GUIAS) as Perfil[]).sort((a, b) => Number(b === user?.perfil) - Number(a === user?.perfil));

  return (
    <div className="pagina space-y-5">
      <PageHeader titulo="Ajuda" descricao="O essencial de cada função, o percurso de uma viatura e a quem pedir apoio" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="O essencial de cada função" subtitle="A sua função aparece primeiro" />
            <div className="divide-y divide-linha/70">
              {perfis.map((p) => (
                <details key={p} open={p === user?.perfil} className="group px-5 py-3">
                  <summary className="cursor-pointer list-none text-[13.5px] font-semibold text-mzd-black marker:hidden">
                    <span className="mr-2 inline-block text-mzd-gray transition-transform group-open:rotate-90" aria-hidden>›</span>
                    {PERFIL_LABEL[p]}{p === user?.perfil && <span className="ml-2 text-xs font-normal text-mzd-gray">(a sua função)</span>}
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-9 text-[13px] text-mzd-graphite">
                    {GUIAS[p].map((g) => <li key={g}>{g}</li>)}
                  </ul>
                </details>
              ))}
            </div>
          </Card>

          <Card>
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

          <Card>
            <CardHeader title="Dúvidas frequentes" />
            <dl className="divide-y divide-linha/70">
              {DUVIDAS.map(([p, r]) => (
                <div key={p} className="px-5 py-3">
                  <dt className="text-[13.5px] font-semibold text-mzd-black">{p}</dt>
                  <dd className="mt-0.5 text-[13px] text-mzd-graphite">{r}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        <div className="space-y-4 self-start">
          <Card>
            <CardHeader title="Apoio" subtitle="Dúvidas sobre o sistema: fale primeiro com a Direção" />
            <div className="space-y-3 px-5 py-4 text-sm">
              {config?.empresa.telefone && (
                <a href={`tel:${config.empresa.telefone.replace(/\s/g, '')}`} className="flex items-center gap-2.5 text-mzd-black hover:underline"><Phone size={15} /> <span className="num">{config.empresa.telefone}</span></a>
              )}
              {config?.empresa.email && (
                <a href={`mailto:${config.empresa.email}?subject=${encodeURIComponent('Apoio — sistema da oficina')}`} className="flex items-center gap-2.5 text-mzd-black hover:underline"><Mail size={15} /> {config.empresa.email}</a>
              )}
              <p className="text-xs text-mzd-gray">Ao pedir ajuda, diga o número do processo e o que estava a fazer.</p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Atalhos de teclado" />
            <dl className="divide-y divide-linha/70">
              {ATALHOS.map(([k, v]) => (
                <div key={k} className="px-5 py-2.5">
                  <dt className="num text-xs font-semibold text-mzd-black">{k}</dt>
                  <dd className="text-[12.5px] text-mzd-gray">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
