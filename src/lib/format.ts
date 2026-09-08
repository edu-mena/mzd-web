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

export function orcamentoTotal(orcamento?: { pecas: { quantidade: number; precoUnitario: number }[]; maoObra: { horas: number; valorHora: number }[] }): number {
  if (!orcamento) return 0;
  const p = orcamento.pecas.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);
  const m = orcamento.maoObra.reduce((s, i) => s + i.horas * i.valorHora, 0);
  return p + m;
}
