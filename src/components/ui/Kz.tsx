import clsx from 'clsx';
import { formatAOA } from '../../lib/format';

/** Valor em kwanzas com algarismos alinhados. */
export default function Kz({ valor, className }: { valor: number; className?: string }) {
  return <span className={clsx('num whitespace-nowrap', className)}>{formatAOA(valor)}</span>;
}
