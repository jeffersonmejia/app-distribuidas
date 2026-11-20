// SOLID: SRP — UTILIDADES PARA FORMATEO DE MONEDA Y DERIVACIÓN DE ESTADOS DE INVENTARIO.

import type { ProductStatus } from '../types/product'

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

/**
 * Deriva el estado del producto ('low' | 'available') en base a su stock y stock mínimo.
 */
export function deriveProductStatus(stock: number, minStock: number): ProductStatus {
  return stock <= minStock ? 'low' : 'available'
}
