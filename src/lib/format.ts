export function formatAOA(v: number): string {
  return new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 0 }).format(v) + ' Kz';
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function diasEntre(a: string, b: string = new Date().toISOString()): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function iniciais(nome: string): string {
  return nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

export type FormatoIndicador = 'kz' | 'n' | 'pct' | 'dias';

export const formatarIndicador = (v: number, f: FormatoIndicador) =>
  f === 'kz' ? formatAOA(v) : f === 'pct' ? `${v.toLocaleString('pt-PT')}%` : f === 'dias' ? `${v.toLocaleString('pt-PT')} dias` : v.toLocaleString('pt-PT');

/** Dia "AAAA-MM-DD" (sem hora) → "dd/mm/aaaa". */
export function formatDia(dia: string): string {
  return formatDate(`${dia}T12:00:00`);
}
