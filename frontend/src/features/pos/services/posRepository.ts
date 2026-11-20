// SOLID: ISP — DEFINE LA INTERFAZ Y ERRORES DEL CONTRATO DE REPOSITORIO DE VENTAS.

import type {
  Sale,
  SaleFilters,
  SalePage,
  SaleMetrics,
  SaleInput,
} from '../types/sale'

export class PosApiError extends Error {
  readonly kind: 'validation' | 'not_found' | 'service_unavailable' | 'unknown'
  readonly details?: Record<string, string>

  constructor(
    message: string,
    kind: 'validation' | 'not_found' | 'service_unavailable' | 'unknown',
    details?: Record<string, string>
  ) {
    super(message)
    this.name = 'PosApiError'
    this.kind = kind
    this.details = details
  }
}

export interface PosRepository {
  list(filters?: SaleFilters, page?: number): Promise<SalePage>
  getById(id: string): Promise<Sale>
  getMetrics?(): Promise<SaleMetrics>
  createSale?(input: SaleInput): Promise<Sale>
}
