import { Link } from 'react-router-dom';
import { botao } from '../components/ui/botao';

export default function NaoEncontrada() {
  return (
    <div className="pagina mx-auto max-w-md py-20 text-center">
      <p className="num text-5xl font-semibold text-zinc-300">404</p>
      <h1 className="mt-3 text-xl font-extrabold text-mzd-black">Página não encontrada</h1>
      <p className="mt-1 text-sm text-mzd-gray">O endereço pode estar errado ou a página foi removida.</p>
      <Link to="/" className={botao('secundario', 'md', 'mt-6')}>Voltar ao painel</Link>
    </div>
  );
}
