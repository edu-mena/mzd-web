/**
 * Descarrega uma tabela em CSV para abrir no Excel (separador ";" e BOM UTF-8, como o Excel em português espera).
 */
export function descarregarCsv(nome: string, cabecalho: string[], linhas: (string | number | null | undefined)[][]) {
  const celula = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'number' ? String(v).replace('.', ',') : v;
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const texto = [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿', texto], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nome}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
