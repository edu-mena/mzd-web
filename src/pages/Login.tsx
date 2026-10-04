import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { API_MODE } from '../api/client';
import { mensagemErro } from '../lib/erros';
import { ESTADOS_ORDEM, PERFIL_LABEL } from '../types';
import type { Perfil } from '../types';
import Button from '../components/ui/Button';
import { Field, Input } from '../components/ui/Form';
import { Aviso } from '../components/ui/Controls';
import logoMzd from '../assets/logo.png';

const esquema = z.object({
  email: z.string().trim().min(1, 'Indique o email.').email('Email inválido.'),
  senha: z.string().min(1, 'Indique a palavra-passe.'),
});
type Dados = z.infer<typeof esquema>;

// Contas de demonstração (apenas no modo simulado). Palavra-passe: mzd2026.
const CONTAS_DEMO: { email: string; perfil: Perfil }[] = [
  { email: 'edna.sambo@mzdcarros.ao', perfil: 'rececao' },
  { email: 'amelia.zola@mzdcarros.ao', perfil: 'direcao' },
  { email: 'joel.paulo@mzdcarros.ao', perfil: 'chefe_oficina' },
  { email: 'sara.neto@mzdcarros.ao', perfil: 'rececionista' },
  { email: 'domingos.kiala@mzdcarros.ao', perfil: 'mecanico' },
  { email: 'catia.fortunato@mzdcarros.ao', perfil: 'administrativa' },
  { email: 'nelson.tavares@mzdcarros.ao', perfil: 'admin' },
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destino = (location.state as { de?: string } | null)?.de ?? '/';
  const [erro, setErro] = useState<string | null>(null);
  const [verSenha, setVerSenha] = useState(false);
  useEffect(() => {
    document.title = 'Entrar · MZD Carros e Motores';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Dados>({
    resolver: zodResolver(esquema),
    defaultValues: { email: '', senha: '' },
  });

  if (user) return <Navigate to={destino} replace />;

  async function entrar(dados: Dados) {
    setErro(null);
    try {
      await login(dados.email, dados.senha);
      navigate(destino, { replace: true });
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  return (
    <div className="grid min-h-[100dvh] bg-papel lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-mzd-black p-10 text-white lg:flex">
        <div className="self-start rounded-md bg-white p-2.5">
          <img src={logoMzd} alt="Grupo MZD — MZD Carros e Motores" className="h-9 w-auto" />
        </div>

        <div className="relative">
          <p className="rotulo !text-zinc-400">Gestão de oficina</p>
          <p className="mt-3 max-w-md font-display text-[34px] font-extrabold leading-[1.08] [font-stretch:108%]">
            Cada viatura, do portão à entrega. Quem fez o quê, e quando.
          </p>
          {/* O percurso de um processo, como régua — a mesma linguagem visual do sistema. */}
          <ol className="mt-10 grid max-w-md grid-cols-8 gap-1" aria-hidden>
            {ESTADOS_ORDEM.map((e, i) => (
              <li key={e}>
                <span className={`block h-[5px] rounded-[1px] ${i < 5 ? 'bg-white' : i === 5 ? 'bg-mzd-red' : 'bg-white/15'}`} />
                <span className="num mt-1.5 block text-[10px] text-zinc-400">{String(i + 1).padStart(2, '0')}</span>
              </li>
            ))}
          </ol>
        </div>

        <p className="text-xs text-zinc-400">MZD Carros e Motores · Luanda</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 inline-flex items-center gap-1.5 text-xs font-semibold text-mzd-gray hover:text-mzd-black">
            <ArrowLeft size={14} /> Voltar ao site
          </Link>
          <img src={logoMzd} alt="Grupo MZD" className="mb-10 h-9 w-auto lg:hidden" />
          <h1 className="text-2xl font-extrabold text-mzd-black">Iniciar sessão</h1>
          <p className="mt-1 text-sm text-mzd-gray">Use o email e a palavra-passe atribuídos pela oficina.</p>

          <form onSubmit={handleSubmit(entrar)} noValidate className="mt-7 space-y-4">
            <Field label="Email" erro={errors.email?.message}>
              {(a) => <Input {...a} {...register('email')} type="email" autoComplete="username" autoFocus />}
            </Field>
            <Field label="Palavra-passe" erro={errors.senha?.message}>
              {(a) => (
                <div className="relative">
                  <Input {...a} {...register('senha')} type={verSenha ? 'text' : 'password'} autoComplete="current-password" className="pr-10" />
                  <button
                    type="button"
                    onClick={() => setVerSenha((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-mzd-gray hover:text-mzd-black"
                    aria-label={verSenha ? 'Esconder palavra-passe' : 'Mostrar palavra-passe'}
                  >
                    {verSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              )}
            </Field>

            {erro && <Aviso tom="vermelho">{erro}</Aviso>}

            <Button type="submit" carregando={isSubmitting} className="w-full">Entrar</Button>
          </form>

          {API_MODE === 'mock' && (
            <div className="mt-10 border-t border-linha pt-5">
              <p className="rotulo">Modo de demonstração</p>
              <p className="mt-1 text-xs text-mzd-gray">
                Os dados ficam guardados apenas neste navegador. Escolha um perfil (palavra-passe <span className="num">mzd2026</span>):
              </p>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {CONTAS_DEMO.map((c) => (
                  <button
                    key={c.email}
                    type="button"
                    onClick={() => {
                      setValue('email', c.email);
                      setValue('senha', 'mzd2026');
                    }}
                    className="rounded-md border border-linha-forte bg-white px-2.5 py-2 text-left text-xs font-medium text-mzd-black transition-colors hover:border-mzd-black"
                  >
                    {PERFIL_LABEL[c.perfil]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
