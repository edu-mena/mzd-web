// Tokens partilhados pelos gráficos (Recharts), alinhados com o sistema visual.
// Tinta para os dados, vermelho só para destacar o que pede atenção.

export const COR = {
  tinta: '#141414',
  tintaSuave: '#77746c',
  sinal: '#e60000',
  grelha: '#e2e0d9',
  eixo: '#66645e',
};

export const eixo = {
  tick: { fontSize: 11.5, fill: COR.eixo, fontFamily: 'Instrument Sans' },
  axisLine: { stroke: COR.grelha },
  tickLine: false,
} as const;

export const tooltip = {
  contentStyle: {
    borderRadius: 6,
    border: `1px solid ${COR.grelha}`,
    fontSize: 12,
    fontFamily: 'Instrument Sans',
    boxShadow: '0 8px 24px -8px rgb(20 20 20 / 0.18)',
  },
  cursor: { fill: '#f3f2ee' },
} as const;

export const milhares = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1).replace('.', ',')}M` : `${Math.round(v / 1000)}k`);
