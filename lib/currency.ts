// Fixed SAR<->USD exchange rate for SwiftRBX.
export const SAR_PER_USD = 3.75

export function sarToUsd(sar: number): number {
  return sar / SAR_PER_USD
}

export function usdToSar(usd: number): number {
  return usd * SAR_PER_USD
}

export function formatSar(sar: number): string {
  return `${sar.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`
}

export function formatUsd(usd: number): string {
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
