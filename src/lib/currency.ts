// §5.2 Four-Tier Currency Engine — 1 Platinum = 100 Gold = 10,000 Silver = 1,000,000 Base Copper.
export function formatCurrency(baseCopper: number): { p: number; g: number; s: number; c: number } {
  let remaining = Math.max(0, Math.round(baseCopper))
  const p = Math.floor(remaining / 1_000_000)
  remaining -= p * 1_000_000
  const g = Math.floor(remaining / 10_000)
  remaining -= g * 10_000
  const s = Math.floor(remaining / 100)
  remaining -= s * 100
  return { p, g, s, c: remaining }
}

export function currencyLabel(baseCopper: number): string {
  const { p, g, s, c } = formatCurrency(baseCopper)
  return `${p}P ${g}G ${s}S ${c}C`
}
