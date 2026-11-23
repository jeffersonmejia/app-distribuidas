// SOLID: ISP — DEFINE LA INTERFAZ Y ERRORES DEL CONTRATO DE REPOSITORIO DE INVENTARIO.

import type {
  Product,
  ProductInput,
  ProductFilters,
  ProductPage,
  InventoryMetrics,
  StockLineCommand,
  StockConsumptionResult,
} from '../types/product'

export class InventoryApiError extends Error {
  readonly kind: 'validation' | 'insufficient_availability' | 'not_found' | 'conflict' | 'service_unavailable' | 'unknown'
  readonly details?: Record<string, string>

  constructor(
    message: string,
    kind: 'validation' | 'insufficient_availability' | 'not_found' | 'conflict' | 'service_unavailable' | 'unknown',
    details?: Record<string, string>
  ) {
    super(message)
    this.name = 'InventoryApiError'
    this.kind = kind
    this.details = details
  }
}

export interface InventoryRepository {
  list(filters?: ProductFilters, page?: number): Promise<ProductPage>
  create(input: ProductInput): Promise<Product>
  getMetrics?(): Promise<InventoryMetrics>
  getAvailability?(productId: string): Promise<number>
  consumeStock?(lines: StockLineCommand[]): Promise<StockConsumptionResult>
  getById?(productId: string): Promise<Product>
}
