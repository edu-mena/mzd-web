import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Car, CornerDownLeft, FileText, Plus, Search, User } from 'lucide-react';
import clsx from 'clsx';
import { useClientes, useProcessos, useViaturas } from '../../api/hooks';
import { useAuth } from '../../auth/useAuth';
import type { Permissao } from '../../auth/permissions';
import { ESTADO_LABEL, estaAtivo } from '../../types';
import { useDialogo } from '../ui/useDialogo';
import Matricula from '../ui/Matricula';

interface Item {
  id: string;
  grupo: 'Ações' | 'Processos' | 'Viaturas' | 'Clientes' | 'Páginas';
  titulo: ReactNode;
  detalhe?: ReactNode;
  icone: ReactNode;
  to: string;
}

const ACOES: { titulo: string; to: string; permissao: Permissao; termos: string }[] = [
  { titulo: 'Nova receção', to: '/processos/novo', permissao: 'processos.criar', termos: 'nova receção abrir processo entrada' },
  { titulo: 'Nova marcação', to: '/agenda?nova=1', permissao: 'agenda.gerir', termos: 'nova marcação agendar agenda' },
];
/** `termos`: outras palavras por que as pessoas procuram a página. */
const PAGINAS: { titulo: string; to: string; permissao?: Permissao; termos?: string }[] = [
  { titulo: 'Painel', to: '/', permissao: 'painel.ver' },
  { titulo: 'Processos', to: '/processos', permissao: 'processos.ver' },
  { titulo: 'Oficina (carga por mecânico)', to: '/oficina', permissao: 'processos.atribuir' },
  { titulo: 'Processos atrasados', to: '/processos?filtro=atrasados&vista=lista', permissao: 'processos.ver' },
  { titulo: 'Clientes', to: '/clientes', permissao: 'clientes.ver' },
  { titulo: 'Viaturas', to: '/viaturas', permissao: 'viaturas.ver' },
  { titulo: 'Agenda', to: '/agenda', permissao: 'agenda.ver', termos: 'marcações calendário entregas' },
  { titulo: 'Peças e stock', to: '/pecas', permissao: 'pecas.ver', termos: 'inventário encomendas fornecedores armazém' },
  { titulo: 'Comunicações', to: '/comunicacoes', permissao: 'mensagens.enviar', termos: 'mensagens whatsapp email avisar clientes modelos lembretes' },
  { titulo: 'Financeiro (faturas, caixa, dívidas)', to: '/faturacao', permissao: 'faturacao.ver', termos: 'faturação recibos pagamentos cobranças descontos fecho' },
  { titulo: 'Relatórios', to: '/relatorios', permissao: 'relatorios.ver' },
  { titulo: 'Equipa', to: '/equipa', permissao: 'equipa.ver' },
  { titulo: 'Definições', to: '/definicoes', permissao: 'definicoes.gerir' },
  { titulo: 'Ajuda', to: '/ajuda' },
];

const semAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Pesquisa global e atalhos (Ctrl+K / ⌘K). */
export default function PaletaComandos({ open, onClose }: { open: boolean; onClose: () => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  useDialogo(open, onClose, caixa);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-mzd-black/40 px-3 pt-[10vh] backdrop-blur-[2px]" onClick={onClose}>
      <div ref={caixa} role="dialog" aria-modal="true" aria-label="Pesquisa global" className="w-full max-w-xl animate-entrada overflow-hidden rounded-lg border border-linha bg-white shadow-flutuante" onClick={(e) => e.stopPropagation()}>
        <Conteudo onClose={onClose} />
      </div>
    </div>,
    document.body
  );
}

function Conteudo({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [ativo, setAtivo] = useState(0);
  const lista = useRef<HTMLUListElement>(null);
  const { data: processos = [] } = useProcessos();
  const { data: viaturas = [] } = useViaturas();
  const { data: clientes = [] } = useClientes({ enabled: can('clientes.ver') });

  const itens = useMemo<Item[]>(() => {
    const t = semAcentos(q.trim());
    const digitos = t.replace(/[^0-9a-z]/g, '');
    const corresponde = (...campos: (string | undefined)[]) => campos.some((c) => c && semAcentos(c).includes(t));
    const r: Item[] = [];

    ACOES.filter((a) => can(a.permissao) && (!t || corresponde(a.titulo, a.termos))).forEach((a) =>
      r.push({ id: a.to, grupo: 'Ações', titulo: a.titulo, icone: <Plus size={15} />, to: a.to })
    );
    if (t.length >= 2) {
      processos
        .filter((p) => corresponde(p.numero, p.cliente.nome) || p.viatura.matricula.toLowerCase().replace(/[^0-9a-z]/g, '').includes(digitos))
        .sort((a, b) => Number(estaAtivo(b.estado)) - Number(estaAtivo(a.estado)) || b.criadoEm.localeCompare(a.criadoEm))
        .slice(0, 5)
        .forEach((p) => r.push({
          id: `p-${p.id}`, grupo: 'Processos', icone: <FileText size={15} />, to: `/processos/${p.id}`,
          titulo: <span className="flex items-center gap-2"><span className="num">{p.numero}</span><Matricula valor={p.viatura.matricula} tamanho="sm" /></span>,
          detalhe: `${p.cliente.nome} · ${ESTADO_LABEL[p.estado]}`,
        }));
      viaturas
        .filter((v) => v.matricula.toLowerCase().replace(/[^0-9a-z]/g, '').includes(digitos) || corresponde(`${v.marca} ${v.modelo}`))
        .slice(0, 4)
        .forEach((v) => r.push({
          id: `v-${v.id}`, grupo: 'Viaturas', icone: <Car size={15} />, to: `/viaturas/${v.id}`,
          titulo: <span className="flex items-center gap-2"><Matricula valor={v.matricula} tamanho="sm" />{v.marca} {v.modelo}</span>,
          detalhe: v.cliente.nome,
        }));
      clientes
        .filter((c) => corresponde(c.nome, c.email, c.nif) || (digitos.length >= 3 && /^\d+$/.test(digitos) && c.telefone.replace(/\D/g, '').includes(digitos)))
        .slice(0, 4)
        .forEach((c) => r.push({ id: `c-${c.id}`, grupo: 'Clientes', icone: <User size={15} />, to: `/clientes/${c.id}`, titulo: c.nome, detalhe: c.telefone }));
    }
    PAGINAS.filter((p) => (!p.permissao || can(p.permissao)) && (t ? corresponde(p.titulo, p.termos) : true))
      .slice(0, t ? 3 : 6)
      .forEach((p) => r.push({ id: `pg-${p.to}`, grupo: 'Páginas', icone: <ArrowRight size={15} />, to: p.to, titulo: p.titulo }));
    return r;
  }, [q, processos, viaturas, clientes, can]);

  const indice = Math.min(ativo, Math.max(itens.length - 1, 0));
  function ir(item: Item | undefined) {
    if (!item) return;
    onClose();
    navigate(item.to);
  }
  function teclas(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = (indice + (e.key === 'ArrowDown' ? 1 : -1) + itens.length) % Math.max(itens.length, 1);
      setAtivo(n);
      lista.current?.querySelector(`[data-indice="${n}"]`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      ir(itens[indice]);
    }
  }

  let grupoAnterior = '';
  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-linha px-4">
        <Search size={17} className="shrink-0 text-mzd-gray" />
        <input
          autoFocus
          value={q}
          onChange={(e) => { setQ(e.target.value); setAtivo(0); }}
          onKeyDown={teclas}
          placeholder="Matrícula, nº de processo, cliente, telefone…"
          role="combobox"
          aria-expanded="true"
          aria-controls="paleta-resultados"
          aria-activedescendant={itens[indice] ? `paleta-${indice}` : undefined}
          aria-label="Pesquisar"
          className="h-14 w-full bg-transparent text-[15px] outline-none placeholder:text-zinc-400"
        />
        <kbd className="num shrink-0 rounded border border-linha px-1.5 py-0.5 text-[10.5px] text-mzd-gray">Esc</kbd>
      </div>
      <ul ref={lista} id="paleta-resultados" role="listbox" className="max-h-[55vh] overflow-y-auto py-1.5">
        {itens.map((item, i) => {
          const cabecalho = item.grupo !== grupoAnterior;
          grupoAnterior = item.grupo;
          return (
            <li key={item.id} role="presentation">
              {cabecalho && <p className="rotulo px-4 pb-1 pt-2.5">{item.grupo}</p>}
              <div
                id={`paleta-${i}`}
                data-indice={i}
                role="option"
                aria-selected={i === indice}
                onMouseMove={() => setAtivo(i)}
                onClick={() => ir(item)}
                className={clsx('mx-1.5 flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2', i === indice ? 'bg-zinc-100' : '')}
              >
                <span className="shrink-0 text-mzd-gray">{item.icone}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-mzd-black">{item.titulo}</span>
                  {item.detalhe && <span className="block truncate text-xs text-mzd-gray">{item.detalhe}</span>}
                </span>
                {i === indice && <CornerDownLeft size={14} className="shrink-0 text-mzd-gray" />}
              </div>
            </li>
          );
        })}
        {itens.length === 0 && <li className="px-4 py-8 text-center text-sm text-mzd-gray">Sem resultados para "{q}".</li>}
      </ul>
      <p className="flex gap-4 border-t border-linha bg-zinc-50/70 px-4 py-2 text-[11px] text-mzd-gray">
        <span><kbd className="num">↑↓</kbd> navegar</span>
        <span><kbd className="num">Enter</kbd> abrir</span>
        <span className="ml-auto">Abrir em qualquer página: <kbd className="num">Ctrl K</kbd></span>
      </p>
    </>
  );
}
