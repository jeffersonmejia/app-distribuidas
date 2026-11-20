// SOLID: ISP — DEFINE LOS MODELOS DE DATOS, FILTROS Y ENUMS PARA LA FEATURE DE INVENTARIO.

export type ProductCategory =
  | 'Materiales'
  | 'Equipos'
  | 'Herramientas'
  | 'Repuestos'
  | 'Servicios'

export type ProductStatus = 'available' | 'low'

export interface Product {
  id: string
  name: string
  sku: string
  category: ProductCategory
  description?: string
  purchasePriceCents: number // En centavos de USD (ej. 850 para $8.50)
  sellingPriceCents: number  // En centavos de USD
  stock: number              // Existencia física actual
  minStock: number           // Nivel mínimo para alerta
  status: ProductStatus      // Derivado: stock <= minStock ? 'low' : 'available'
  createdAt: string
  updatedAt: string
}

export interface ProductInput {
  name: string
  sku: string
  category: ProductCategory
  description?: string
  purchasePriceCents: number
  sellingPriceCents: number
  stock: number
  minStock: number
}

export interface ProductFilters {
  search?: string
  category?: ProductCategory | ''
}

export interface ProductPage {
  items: Product[]
  page: number
  size: number
  hasNext: boolean
}

export interface InventoryMetrics {
  totalProducts: number
  lowStockCount: number
  totalInventoryValueCents: number // Suma de (stock * purchasePriceCents)
  categoryCounts?: Record<ProductCategory, number>
  activeCategoryCount?: number
}

export interface StockLineCommand {
  productId: string
  quantity: number
}

export interface StockConsumptionResult {
  consumed: boolean
  lines: StockLineCommand[]
}
