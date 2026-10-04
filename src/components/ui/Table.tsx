import RegiaoRolavel from './RegiaoRolavel';
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import clsx from 'clsx';

/** Tabela densa com cabeçalho em rótulos e linhas finas; desliza na horizontal em ecrãs pequenos. */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <RegiaoRolavel className={className}>
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </RegiaoRolavel>
  );
}

/** Cabeçalho de coluna. `scope="col"` garante que os leitores de ecrã o anunciam como cabeçalho. */
export function Th({ className, direita, children, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { direita?: boolean }) {
  return (
    <th
      scope="col"
      className={clsx('rotulo relative whitespace-nowrap border-b border-linha bg-zinc-50/60 px-4 py-2 font-bold', direita ? 'text-right' : 'text-left', className)}
      {...props}
    >
      {/* Coluna de botões sem título visível: os leitores de ecrã ouvem "Ações". */}
      {children ?? <span className="sr-only">Ações</span>}
    </th>
  );
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={clsx('border-b border-linha/70 last:border-0 hover:bg-zinc-50', className)} {...props} />;
}

export function Td({ className, direita, num, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { direita?: boolean; num?: boolean }) {
  return <td className={clsx('px-4 py-2.5 align-middle', direita && 'text-right', num && 'num', className)} {...props} />;
}

export function LinhaVazia({ colunas, children }: { colunas: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colunas} className="px-4 py-10 text-center text-sm text-mzd-gray">{children}</td>
    </tr>
  );
}
