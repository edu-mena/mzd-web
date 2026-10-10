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

/** Soma `n` dias a um dia "AAAA-MM-DD". */
export function somarDiasISO(dia: string, n: number): string {
  return diaISO(somarDias(new Date(`${dia}T12:00:00`), n));
}

/** Nº de dias de `de` a `ate`, inclusive ("AAAA-MM-DD"); 0 se `ate` for antes de `de`. */
export function diasInclusive(de: string, ate: string): number {
  if (ate < de) return 0;
  return Math.round((new Date(`${ate}T12:00:00`).getTime() - new Date(`${de}T12:00:00`).getTime()) / 86400000) + 1;
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
function pascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  return new Date(ano, mes - 1, ((h + l - 7 * m + 114) % 31) + 1, 12);
}

/**
 * Feriados nacionais de Angola (Lei n.º 11/18 e alterações). Confirmar a lista com a Direção;
 * o PHP deve usar a mesma (de preferência numa tabela que se possa atualizar).
 */
const FERIADOS_FIXOS = ['01-01', '02-04', '03-08', '03-23', '04-04', '05-01', '09-17', '11-02', '11-11', '12-25'];

export function ehFeriado(dia: string): boolean {
  if (FERIADOS_FIXOS.includes(dia.slice(5))) return true;
  const p = pascoa(Number(dia.slice(0, 4)));
  // Carnaval (terça-feira, 47 dias antes da Páscoa) e Sexta-Feira Santa.
  return dia === diaISO(somarDias(p, -47)) || dia === diaISO(somarDias(p, -2));
}

/** Dia útil: de segunda a sexta, fora dos feriados nacionais. */
export function ehDiaUtil(dia: string): boolean {
  const semana = new Date(`${dia}T12:00:00`).getDay();
  return semana !== 0 && semana !== 6 && !ehFeriado(dia);
}

/** O `n`-ésimo dia útil depois de `dia` (o próprio dia não conta). */
export function somarDiasUteis(dia: string, n: number): string {
  let d = dia;
  for (let contados = 0; contados < n;) {
    d = somarDiasISO(d, 1);
    if (ehDiaUtil(d)) contados++;
  }
  return d;
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

/** Tempo decorrido em linguagem corrente: "há 12 min", "há 5 h", "há 3 dias". */
export function haQuanto(iso: string, agora: number): string {
  const min = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d > 1 ? 's' : ''}`;
}
