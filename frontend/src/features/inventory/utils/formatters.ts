// SOLID: SRP — UTILIDADES PARA FORMATEO DE MONEDA Y DERIVACIÓN DE ESTADOS DE INVENTARIO.

import type { ProductStatus } from '../types/product'
export { formatMoney } from '../../../utils/formatMoney'

/**
 * Deriva el estado del producto ('low' | 'available') en base a su stock y stock mínimo.
 */
export function deriveProductStatus(stock: number, minStock: number): ProductStatus {
  return stock <= minStock ? 'low' : 'available'
}
