// SOLID: ISP — DEFINE LOS MODELOS DE DATOS, FILTROS Y ENUMS PARA LA FEATURE DE VENTAS.

export type SaleStatus = 'paid' | 'pending' | 'overdue' | 'confirmed'

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
  name?: string
  sku?: string
  unit?: string
  quantity: number
  unitPriceCents: number
  subtotalCents: number
  taxAmountCents?: number
}

export interface Sale {
  id: string
  receiptNumber?: string // Solo existe en el mock de comprobantes.
  type?: SaleType
  customerName?: string
  customerIdentification?: string
  issuedAt?: string
  paymentMethod?: PaymentMethod
  status: SaleStatus
  lines: SaleLine[]
  subtotal0Cents?: number
  subtotalGravadoCents?: number
  discountCents?: number
  ivaCents?: number
  totalCents: number
  notes?: string
  saleId?: string
  movementId?: string
  createdAt?: string
}

export interface ContractSaleLineInput {
  productId: string
  unit: string
  quantity: string
  unitPrice: string
  taxAmount: string
}

export interface ContractSaleInput {
  saleId: string
  lines: ContractSaleLineInput[]
}

export interface ContractSaleView {
  saleId: string
  movementId: string
  createdAt: string
  lines: Array<ContractSaleLineInput & { netAmount: string }>
}

export interface CreateSaleLineInput {
  productId: string
  quantity: number
  unitPriceCents?: number
  unit?: string
  taxAmountCents?: number
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
