// SOLID: ISP — DEFINE LA INTERFAZ DEL REPOSITORIO DE CLIENTES Y EL MODELO DE ERRORES.

import type {
  CustomerFilters,
  CustomerInput,
  CustomerMetrics,
  CustomerPage,
  CustomerStatus,
  CustomerView,
} from '../types/customer'

export type CustomerApiErrorKind =
  | 'validation'
  | 'duplicate'
  | 'unauthorized'
  | 'forbidden'
  | 'unknown'

export class CustomerApiError extends Error {
  readonly kind: CustomerApiErrorKind
  readonly status?: number

  constructor(message: string, kind: CustomerApiErrorKind = 'unknown', status?: number) {
    super(message)
    this.name = 'CustomerApiError'
    this.kind = kind
    this.status = status
  }
}

export interface CustomerRepository {
  list(filters?: CustomerFilters, page?: number): Promise<CustomerPage>
  create(input: CustomerInput): Promise<CustomerView>
  setStatus(id: string, status: CustomerStatus): Promise<CustomerView>
  /** Opcional: Métricas de clientes calculadas en memoria para modo simulado. No presente en API real. */
  getMetrics?(): Promise<CustomerMetrics>
}
