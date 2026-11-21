// SOLID: SRP - FORMATEA IMPORTES CONTABLES SIN SIMBOLO DE MONEDA.
export function formatAccountingAmount(cents: number): string {
  return new Intl.NumberFormat('es-EC', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}
