import { diaISO } from './datas';

export type IdPeriodo = 'mes' | 'mes-anterior' | '90d' | 'ano';

export const PERIODOS: { id: IdPeriodo; label: string }[] = [
  { id: 'mes', label: 'Este mês' },
  { id: 'mes-anterior', label: 'Mês passado' },
  { id: '90d', label: '90 dias' },
  { id: 'ano', label: 'Este ano' },
];

/** Datas ("AAAA-MM-DD", inclusive) de um período predefinido. */
export function intervaloDe(id: IdPeriodo, hoje = new Date()): { de: string; ate: string } {
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  switch (id) {
    case 'mes':
      return { de: diaISO(new Date(y, m, 1)), ate: diaISO(hoje) };
    case 'mes-anterior':
      return { de: diaISO(new Date(y, m - 1, 1)), ate: diaISO(new Date(y, m, 0)) };
    case '90d':
      return { de: diaISO(new Date(y, m, hoje.getDate() - 89)), ate: diaISO(hoje) };
    case 'ano':
      return { de: diaISO(new Date(y, 0, 1)), ate: diaISO(hoje) };
  }
}

export const dataCurta = (dia: string) => new Date(`${dia}T12:00:00`).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
