// Datas no fuso local da oficina (Luanda). Usar sempre estas funções para chaves de dia.

/** "AAAA-MM-DD" no fuso local. */
export function diaISO(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** Segunda-feira da semana de `d`, às 00:00. */
export function inicioSemana(d: Date): Date {
  const data = new Date(d);
  data.setDate(data.getDate() - ((data.getDay() + 6) % 7));
  data.setHours(0, 0, 0, 0);
  return data;
}

export function somarDias(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function horaCurta(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

/** Horários de entrada: 07:30–18:00 (sábado até 13:00), de 30 em 30 minutos. Domingo fechado. */
export function horariosDoDia(dia: string): string[] {
  const d = new Date(`${dia}T12:00:00`);
  if (d.getDay() === 0) return [];
  const fim = d.getDay() === 6 ? 13 * 60 : 18 * 60;
  const r: string[] = [];
  for (let m = 7 * 60 + 30; m <= fim; m += 30) r.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  return r;
}
