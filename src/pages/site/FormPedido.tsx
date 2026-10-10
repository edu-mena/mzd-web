import { useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../api/endpoints';
import type { NovoPedido } from '../../api/endpoints';
import { mensagemErro } from '../../lib/erros';
import { diaISO } from '../../lib/datas';

const CAMPO = 'h-12 w-full rounded-[3px] border border-linha-forte bg-white px-3.5 text-[15px] text-mzd-black outline-none transition-colors placeholder:text-zinc-500 hover:border-zinc-500 focus:border-mzd-black focus:ring-1 focus:ring-mzd-black';

/**
 * Pedido de serviço/orçamento. A viatura (marca e modelo, qualquer marca) e o serviço podem vir escolhidos
 * de outras secções da página. Não cria cliente nem marcação: chega à receção, que liga e decide.
 */
export default function FormPedido({ sugestoes, servicos, modelo, setModelo, servico, setServico }: {
  /** Sugestões para a viatura: marcas e modelos da especialidade. */
  sugestoes: string[];
  servicos: string[];
  modelo: string;
  setModelo: (v: string) => void;
  servico: string;
  setServico: (v: string) => void;
}) {
  const [d, setD] = useState({ nome: '', telefone: '+244 ', email: '', matricula: '', dataPreferida: '', mensagem: '', consentimento: false, site: '' });
  const [estado, setEstado] = useState<'editar' | 'aenviar' | 'enviado'>('editar');
  const [erro, setErro] = useState<string | null>(null);
  const [hoje] = useState(() => diaISO(new Date()));
  const pronto = d.nome.trim().length >= 3 && d.telefone.replace(/\D/g, '').length >= 9 && !!servico && d.consentimento;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!pronto) return;
    setErro(null);
    setEstado('aenviar');
    try {
      const dados: NovoPedido = {
        nome: d.nome.trim(), telefone: d.telefone.trim(), email: d.email.trim() || undefined, modelo: modelo || undefined,
        matricula: d.matricula.trim() || undefined, servico, dataPreferida: d.dataPreferida || undefined,
        mensagem: d.mensagem.trim() || undefined, consentimento: d.consentimento, site: d.site,
      };
      await api.site.pedir(dados);
      setEstado('enviado');
    } catch (err) {
      setErro(mensagemErro(err));
      setEstado('editar');
    }
  }

  if (estado === 'enviado') {
    return (
      <div className="flex min-h-[420px] flex-col items-start justify-center rounded-[3px] border border-linha bg-white p-8" role="status">
        <CheckCircle2 size={34} className="text-sinal-verde" />
        <h3 className="mt-4 font-display text-2xl font-extrabold text-mzd-black [font-stretch:110%]">Pedido recebido.</h3>
        <p className="mt-2 max-w-md text-[15px] text-mzd-graphite">
          Obrigado, {d.nome.trim().split(/\s+/)[0]}. Vamos ligar-lhe para o número {d.telefone.trim()} para confirmar o dia e a hora.
        </p>
        <button type="button" onClick={() => { setEstado('editar'); setD({ ...d, mensagem: '' }); }} className="mt-6 text-sm font-semibold text-mzd-black underline underline-offset-4">
          Fazer outro pedido
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} noValidate className="rounded-[3px] border border-linha bg-white p-5 sm:p-7" aria-labelledby="titulo-pedido">
      <h3 id="titulo-pedido" className="sr-only">Pedido de orçamento</h3>
      {/* Campo-armadilha para robôs: invisível para pessoas e leitores de ecrã. */}
      <div className="absolute -left-[9999px]" aria-hidden>
        <label>Não preencher <input tabIndex={-1} autoComplete="off" value={d.site} onChange={(e) => setD({ ...d, site: e.target.value })} /></label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-mzd-black">Marca e modelo da viatura</span>
        <input className={CAMPO} value={modelo} onChange={(e) => setModelo(e.target.value)} list="sugestoes-viatura" maxLength={60} placeholder="Ex.: Toyota Hilux, Hyundai Tucson, Mitsubishi Pajero" autoComplete="off" />
        <datalist id="sugestoes-viatura">{sugestoes.map((x) => <option key={x} value={x} />)}</datalist>
      </label>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-mzd-black">Serviço</span>
          <select className={CAMPO} value={servico} onChange={(e) => setServico(e.target.value)} required>
            <option value="">Escolha…</option>
            {[...servicos, 'Outro / não sei'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-mzd-black">Matrícula <span className="font-normal text-mzd-gray">(opcional)</span></span>
          <input className={clsx(CAMPO, 'num uppercase')} value={d.matricula} onChange={(e) => setD({ ...d, matricula: e.target.value })} placeholder="LD-00-00-AA" autoComplete="off" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-mzd-black">Nome</span>
          <input className={CAMPO} value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} autoComplete="name" required />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-mzd-black">Telefone / WhatsApp</span>
          <input className={clsx(CAMPO, 'num')} type="tel" value={d.telefone} onChange={(e) => setD({ ...d, telefone: e.target.value })} autoComplete="tel" required />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-mzd-black">Email <span className="font-normal text-mzd-gray">(opcional)</span></span>
          <input className={CAMPO} type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} autoComplete="email" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-mzd-black">Dia que dá jeito <span className="font-normal text-mzd-gray">(opcional)</span></span>
          <input className={clsx(CAMPO, 'num')} type="date" min={hoje} value={d.dataPreferida} onChange={(e) => setD({ ...d, dataPreferida: e.target.value })} />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-[13px] font-semibold text-mzd-black">O que se passa com a viatura? <span className="font-normal text-mzd-gray">(opcional)</span></span>
          <textarea className={clsx(CAMPO, 'h-auto py-3')} rows={3} value={d.mensagem} onChange={(e) => setD({ ...d, mensagem: e.target.value })} maxLength={1000} placeholder="Ex.: barulho na suspensão da frente em estrada de terra" />
        </label>
      </div>

      <label className="mt-4 flex items-start gap-2.5 text-[13px] text-mzd-graphite">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-mzd-black" checked={d.consentimento} onChange={(e) => setD({ ...d, consentimento: e.target.checked })} />
        <span>Aceito ser contactado por telefone ou WhatsApp sobre este pedido. Os dados não são usados para mais nada.</span>
      </label>

      {erro && <p role="alert" className="mt-4 rounded-[3px] bg-sinal-vermelho-fundo px-3.5 py-2.5 text-sm text-sinal-vermelho">{erro}</p>}

      <button
        type="submit"
        disabled={!pronto || estado === 'aenviar'}
        className="group mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[3px] bg-mzd-red px-6 text-[15px] font-bold text-white transition-colors hover:bg-mzd-redDark disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
      >
        {estado === 'aenviar' ? 'A enviar…' : 'Pedir orçamento'}
        <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
      </button>
      <p className="mt-3 text-xs text-mzd-gray">Vamos contactá-lo para confirmar. O orçamento é sempre aprovado por si antes de qualquer reparação.</p>
    </form>
  );
}
