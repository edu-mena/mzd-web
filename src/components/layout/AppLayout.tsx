import { Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import ErroAplicacao from '../ErroAplicacao';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { Carregando } from '../ui/Estados';

export default function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { pathname } = useLocation();
  const principal = useRef<HTMLElement>(null);
  const paginaAnterior = useRef(pathname);

  // Ao mudar de página: volta ao topo e o foco passa para o conteúdo (leitores de ecrã e teclado).
  // Compara com a página anterior (e não "primeira vez"), para resistir aos efeitos duplos do modo estrito.
  useEffect(() => {
    if (paginaAnterior.current === pathname) return;
    paginaAnterior.current = pathname;
    principal.current?.scrollTo({ top: 0 });
    principal.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-papel">
      <a href="#conteudo" className="sr-only z-[60] rounded-md bg-mzd-black px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Saltar para o conteúdo
      </a>
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileNavOpen(true)} />
        <main id="conteudo" ref={principal} tabIndex={-1} className="flex-1 overflow-y-auto px-4 py-5 outline-none sm:px-6 sm:py-7 lg:px-8">
          <div className="mx-auto w-full max-w-[1440px]">
            {/* Um erro numa página não deita abaixo o menu; mudar de página limpa-o. */}
            <ErroAplicacao key={pathname}>
              <Suspense fallback={<Carregando />}>
                <Outlet />
              </Suspense>
            </ErroAplicacao>
          </div>
        </main>
      </div>
    </div>
  );
}
