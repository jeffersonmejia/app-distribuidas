// SOLID: ISP — DEFINE LOS MODELOS DE DATOS, FILTROS Y ENUMS PARA LA FEATURE DE VENTAS.

export type SaleStatus = 'paid' | 'pending' | 'overdue'

export type PaymentMethod =
  | 'Efectivo'
  | 'Transferencia'
  | 'Transferencia bancaria'
  | 'Crédito 30 días'
  | 'Tarjeta de Crédito'
  | 'Cheque'

export type SaleType = 'Factura Electrónica' | 'Nota de Venta' | 'Recibo'

export interface SaleLine {
  productId: string
  name: string
  sku: string
  quantity: number
  unitPriceCents: number
  subtotalCents: number
}

export interface Sale {
  id: string
  receiptNumber: string // e.g. '001-001-000000123'
  type: SaleType
  customerName: string
  customerIdentification: string // cédula o RUC
  issuedAt: string // ISO date o YYYY-MM-DD
  paymentMethod: PaymentMethod
  status: SaleStatus
  lines: SaleLine[]
  subtotal0Cents: number
  subtotalGravadoCents: number
  discountCents: number
  ivaCents: number
  totalCents: number
  notes?: string
}

export interface CreateSaleLineInput {
  productId: string
  quantity: number
  unitPriceCents?: number
}

export interface CreateSaleInput {
  customerId?: string
  customerName: string
  customerIdentification: string
  issuedAt?: string
  paymentMethod: PaymentMethod
  type?: SaleType
  lines: CreateSaleLineInput[]
  discountCents?: number
  notes?: string
}

/** Alias para compatibilidad con firmas previas */
export type SaleInput = CreateSaleInput

export interface SaleFilters {
  search?: string
  status?: SaleStatus | ''
}

export interface SalePage {
  items: Sale[]
  page: number
  size: number
  hasNext: boolean
}

export interface SaleMetrics {
  totalSalesThisMonthCents: number
  pendingCents: number
  overdueCents: number
  countByStatus: Record<SaleStatus, number>
}
