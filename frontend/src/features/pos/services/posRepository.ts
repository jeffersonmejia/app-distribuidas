// SOLID: ISP — DEFINE LA INTERFAZ Y ERRORES DEL CONTRATO DE REPOSITORIO DE VENTAS.

import type {
  Sale,
  SaleFilters,
  SalePage,
  SaleMetrics,
  CreateSaleInput,
} from '../types/sale'

export type PosErrorKind =
  | 'validation'
  | 'insufficient_availability'
  | 'not_found'
  | 'service_unavailable'
  | 'unknown'

export class PosApiError extends Error {
  readonly kind: PosErrorKind
  readonly details?: Record<string, string>

  constructor(
    message: string,
    kind: PosErrorKind,
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
  createSale(input: CreateSaleInput): Promise<Sale>
}
