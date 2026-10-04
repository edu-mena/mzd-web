// Política de palavras-passe (o servidor aplica a mesma; o PHP guarda só password_hash).

export const SENHA_MIN = 10;

export function regrasSenha(senha: string, contexto: { email?: string; nome?: string } = {}) {
  const s = senha.toLowerCase();
  const local = contexto.email?.split('@')[0].toLowerCase();
  const nomes = (contexto.nome ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/).filter((n) => n.length >= 3);
  const semAcentos = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return [
    { ok: senha.length >= SENHA_MIN, texto: `Pelo menos ${SENHA_MIN} caracteres` },
    { ok: /[a-zA-Z]/.test(senha) && /\d/.test(senha), texto: 'Letras e números' },
    { ok: !(local && s.includes(local)) && !nomes.some((n) => semAcentos.includes(n)), texto: 'Sem o seu nome nem o email' },
    { ok: !['mzd2026', 'password', '123456', 'qwerty', 'oficina'].some((f) => s.includes(f)), texto: 'Nada óbvio (ex.: "mzd2026")' },
  ];
}

/** Mensagem do primeiro requisito por cumprir, ou null se a palavra-passe serve. */
export function erroSenha(senha: string, contexto: { email?: string; nome?: string } = {}): string | null {
  const falha = regrasSenha(senha, contexto).find((r) => !r.ok);
  return falha ? `Palavra-passe fraca: ${falha.texto.toLowerCase()}.` : null;
}
