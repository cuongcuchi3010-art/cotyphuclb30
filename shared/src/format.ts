/** Định dạng tiền (đơn vị triệu đồng): 850 → "850 tr", 1500 → "1,5 tỷ", 2350 → "2,35 tỷ" */
export function formatMoney(trieu: number): string {
  const neg = trieu < 0;
  const v = Math.abs(trieu);
  let out: string;
  if (v < 1000) {
    out = `${Math.round(v)} tr`;
  } else {
    const ty = Math.round((v / 1000) * 100) / 100;
    out = `${ty
      .toFixed(2)
      .replace(/\.?0+$/, '')
      .replace('.', ',')} tỷ`;
  }
  return neg ? `-${out}` : out;
}
