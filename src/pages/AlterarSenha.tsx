import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Eye, EyeOff, X } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../api/endpoints';
import { chaves } from '../api/hooks';
import { useAuth } from '../auth/useAuth';
import Button from '../components/ui/Button';
import { Field, Input } from '../components/ui/Form';
import { Aviso } from '../components/ui/Controls';
import { useToast } from '../components/ui/toast-context';
import { mensagemErro } from '../lib/erros';
import { regrasSenha } from '../lib/senha';
import logoMzd from '../assets/logo.png';

/**
 * Troca da palavra-passe. Com uma senha temporária é obrigatória (o resto do sistema fica bloqueado
 * até lá, também no servidor); fora disso abre-se pelo menu do utilizador.
 */
export default function AlterarSenha() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const obrigatoria = !!user?.mudarSenha;
  const regras = regrasSenha(nova, { email: user?.email, nome: user?.nome });
  const iguais = nova.length > 0 && nova === confirmar;
  const pronta = atual.length > 0 && regras.every((r) => r.ok) && iguais;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAGuardar(true);
    try {
      const u = await api.auth.mudarSenha(atual, nova);
      qc.setQueryData(chaves.me, u);
      toast('Palavra-passe alterada');
      navigate('/', { replace: true });
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-papel px-4 py-10">
      <form onSubmit={guardar} className="w-full max-w-md rounded-lg border border-linha bg-white p-6 shadow-flutuante sm:p-8" noValidate>
        <img src={logoMzd} alt="MZD Carros e Motores" className="h-9 w-auto" />
        <h1 className="mt-6 font-display text-2xl font-extrabold text-mzd-black">{obrigatoria ? 'Escolha a sua palavra-passe' : 'Alterar palavra-passe'}</h1>
        <p className="mt-1 text-sm text-mzd-gray">
          {obrigatoria ? `Olá ${user?.nome.split(' ')[0]}. Está a usar uma palavra-passe temporária; escolha uma só sua para continuar.` : 'A nova palavra-passe passa a valer em todos os dispositivos.'}
        </p>
        <div className="mt-6 space-y-4">
          {erro && <Aviso tom="vermelho">{erro}</Aviso>}
          <Field label={obrigatoria ? 'Palavra-passe temporária' : 'Palavra-passe atual'}>
            {(a) => <Input {...a} type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} autoFocus />}
          </Field>
          <Field label="Nova palavra-passe">
            {(a) => (
              <div className="relative">
                <Input {...a} type={ver ? 'text' : 'password'} autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} className="pr-10" />
                <button type="button" onClick={() => setVer((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-mzd-gray hover:text-mzd-black" aria-label={ver ? 'Esconder' : 'Mostrar'}>
                  {ver ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            )}
          </Field>
          <ul className="space-y-1" aria-label="Requisitos">
            {regras.map((r) => (
              <li key={r.texto} className={clsx('flex items-center gap-2 text-xs', r.ok ? 'text-sinal-verde' : 'text-mzd-gray')}>
                {r.ok ? <Check size={13} /> : <X size={13} />} {r.texto}
              </li>
            ))}
          </ul>
          <Field label="Repita a nova palavra-passe" erro={confirmar && !iguais ? 'Não coincide.' : undefined}>
            {(a) => <Input {...a} type={ver ? 'text' : 'password'} autoComplete="new-password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />}
          </Field>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          {obrigatoria
            ? <Button variante="fantasma" onClick={async () => { await logout(); navigate('/login', { replace: true }); }}>Sair</Button>
            : <Button variante="fantasma" onClick={() => navigate(-1)}>Cancelar</Button>}
          <Button type="submit" disabled={!pronta} carregando={aGuardar}>Guardar palavra-passe</Button>
        </div>
      </form>
    </div>
  );
}
