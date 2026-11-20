// SOLID: SRP — UTILIDAD COMPARTIDA PARA FORMATEO DE MONEDA EN USD A PARTIR DE CENTAVOS.

/**
 * Convierte un valor monetario en centavos enteros a una cadena formateada en USD ($X.XX).
 */
export function formatMoney(cents: number): string {
  const dollars = cents / 100
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars)
}
