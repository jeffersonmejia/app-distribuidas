// SOLID: SRP — REPOSITORIO EN MEMORIA PARA LA GESTIÓN DE PRODUCTOS Y MOVIMIENTOS DE INVENTARIO CON AISLAMIENTO MULTITENANT.

import type {
  Product,
  ProductInput,
  ProductFilters,
  ProductPage,
  InventoryMetrics,
  StockLineCommand,
  StockConsumptionResult,
} from '../types/product'
import { InventoryApiError, type InventoryRepository } from './inventoryRepository'
import { deriveProductStatus } from '../utils/formatters'
import { MOCK_USER } from '../../identity/services/sessionMock'

const DEFAULT_TENANT_ID = MOCK_USER.tenantId

const MOCK_PRODUCTS_BY_TENANT: Record<string, Product[]> = {
  'tnt-andina-001': [
    {
      id: 'prd-andina-001',
      name: 'Cemento Portland Tipo I (50kg)',
      sku: 'MAT-2026-081',
      category: 'Materiales',
      description: 'Saco de Cemento Portland Tipo I para construcción pesada e infraestructura comercial de 50 kilogramos.',
      purchasePriceCents: 650,
      sellingPriceCents: 850,
      stock: 18,
      minStock: 50,
      status: 'low',
      createdAt: '2026-01-15T08:00:00Z',
      updatedAt: '2026-01-15T08:00:00Z',
    },
    {
      id: 'prd-andina-002',
      name: 'Varilla de Acero Corrugado 12mm',
      sku: 'MAT-2026-044',
      category: 'Materiales',
      description: 'Haz de varillas de acero corrugado de alta resistencia de 12 milímetros para obras de hormigón armado.',
      purchasePriceCents: 1100,
      sellingPriceCents: 1420,
      stock: 340,
      minStock: 100,
      status: 'available',
      createdAt: '2026-01-16T09:00:00Z',
      updatedAt: '2026-01-16T09:00:00Z',
    },
    {
      id: 'prd-andina-003',
      name: 'Taladro Percutor Industrial 850W',
      sku: 'EQP-2026-112',
      category: 'Equipos',
      description: 'Taladro percutor con velocidad variable y mandril metálico reforzado de 13mm.',
      purchasePriceCents: 6800,
      sellingPriceCents: 8990,
      stock: 15,
      minStock: 8,
      status: 'available',
      createdAt: '2026-01-17T10:00:00Z',
      updatedAt: '2026-01-17T10:00:00Z',
    },
    {
      id: 'prd-andina-004',
      name: 'Disco de Corte Diamantado 7"',
      sku: 'HER-2026-095',
      category: 'Herramientas',
      description: 'Disco circular de corte diamantado profesional de 7 pulgadas para concreto y mampostería pesada.',
      purchasePriceCents: 1350,
      sellingPriceCents: 1850,
      stock: 6,
      minStock: 15,
      status: 'low',
      createdAt: '2026-01-18T11:00:00Z',
      updatedAt: '2026-01-18T11:00:00Z',
    },
    {
      id: 'prd-andina-005',
      name: 'Generador Eléctrico a Gasolina 5.5kW',
      sku: 'EQP-2026-019',
      category: 'Equipos',
      description: 'Grupo electrógeno portátil con arranque eléctrico y regulación automática de voltaje AVR.',
      purchasePriceCents: 45000,
      sellingPriceCents: 58500,
      stock: 4,
      minStock: 2,
      status: 'available',
      createdAt: '2026-01-19T12:00:00Z',
      updatedAt: '2026-01-19T12:00:00Z',
    },
    {
      id: 'prd-andina-006',
      name: 'Filtro de Aire Primario para Maquinaria',
      sku: 'REP-2026-302',
      category: 'Repuestos',
      description: 'Elemento filtrante de alta eficiencia para motores diésel de maquinaria pesada.',
      purchasePriceCents: 2200,
      sellingPriceCents: 3100,
      stock: 22,
      minStock: 10,
      status: 'available',
      createdAt: '2026-01-20T13:00:00Z',
      updatedAt: '2026-01-20T13:00:00Z',
    },
    {
      id: 'prd-andina-007',
      name: 'Juego de Llaves Combinadas Cromo Vanadio (12 pzs)',
      sku: 'HER-2026-031',
      category: 'Herramientas',
      description: 'Set de llaves combinadas de 6 a 22 mm forjadas en acero al cromo vanadio satinado.',
      purchasePriceCents: 2800,
      sellingPriceCents: 3950,
      stock: 35,
      minStock: 12,
      status: 'available',
      createdAt: '2026-01-21T14:00:00Z',
      updatedAt: '2026-01-21T14:00:00Z',
    },
    {
      id: 'prd-andina-008',
      name: 'Arena Fina de Río Lavada (m3)',
      sku: 'MAT-2026-105',
      category: 'Materiales',
      description: 'Árido clasificado y lavado para morteros finos y enlucidos técnicos.',
      purchasePriceCents: 1800,
      sellingPriceCents: 2400,
      stock: 40,
      minStock: 25,
      status: 'available',
      createdAt: '2026-01-22T15:00:00Z',
      updatedAt: '2026-01-22T15:00:00Z',
    },
    {
      id: 'prd-andina-009',
      name: 'Mantenimiento Preventivo de Maquinaria en Obra',
      sku: 'SRV-2026-001',
      category: 'Servicios',
      description: 'Servicio técnico especializado de revisión y calibración de equipos en sitio.',
      purchasePriceCents: 5000,
      sellingPriceCents: 8500,
      stock: 999,
      minStock: 1,
      status: 'available',
      createdAt: '2026-01-23T16:00:00Z',
      updatedAt: '2026-01-23T16:00:00Z',
    },
  ],
  'tnt-pacifico-002': [
    {
      id: 'prd-pacifico-001',
      name: 'Pintura Epóxica de Alto Tráfico (Galón)',
      sku: 'MAT-2026-501',
      category: 'Materiales',
      description: 'Recubrimiento epóxico bicomponente para pisos industriales.',
      purchasePriceCents: 3200,
      sellingPriceCents: 4500,
      stock: 80,
      minStock: 20,
      status: 'available',
      createdAt: '2026-02-01T08:00:00Z',
      updatedAt: '2026-02-01T08:00:00Z',
    },
    {
      id: 'prd-pacifico-002',
      name: 'Compresor de Aire 50L 2.5HP',
      sku: 'EQP-2026-502',
      category: 'Equipos',
      description: 'Compresor monofásico lubricado con cabezal de hierro fundido.',
      purchasePriceCents: 18000,
      sellingPriceCents: 24500,
      stock: 3,
      minStock: 5,
      status: 'low',
      createdAt: '2026-02-02T09:00:00Z',
      updatedAt: '2026-02-02T09:00:00Z',
    },
  ],
}

let tenantStores = new Map<string, Product[]>()
let nextPrdId = 500

function initInventoryStores(): void {
  tenantStores = new Map<string, Product[]>()
  for (const [tId, seedList] of Object.entries(MOCK_PRODUCTS_BY_TENANT)) {
    tenantStores.set(tId, seedList.map((p) => ({ ...p })))
  }
}

// Inicialización inicial
initInventoryStores()

function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function matchesProductSearch(product: Product, search: string): boolean {
  const q = search.toLowerCase()
  return (
    product.name.toLowerCase().includes(q) ||
    product.sku.toLowerCase().includes(q) ||
    product.category.toLowerCase().includes(q)
  )
}

// SOLID: SRP — IMPLEMENTA EL REPOSITORIO DE INVENTARIO EN MEMORIA AISLADO POR ORGANIZACIÓN.
export class InventoryMockRepository implements InventoryRepository {
  private explicitTenantId?: string

  constructor(explicitTenantId?: string) {
    this.explicitTenantId = explicitTenantId
  }

  private getActiveTenant(): string {
    return this.explicitTenantId ?? DEFAULT_TENANT_ID
  }

  private getStore(): Product[] {
    const tId = this.getActiveTenant()
    if (!tenantStores.has(tId)) {
      const seed = MOCK_PRODUCTS_BY_TENANT[tId] ?? []
      tenantStores.set(tId, seed.map((p) => ({ ...p })))
    }
    return tenantStores.get(tId)!
  }

  private saveStore(items: Product[]): void {
    const tId = this.getActiveTenant()
    tenantStores.set(tId, items)
  }

  async list(filters: ProductFilters = {}, page = 0): Promise<ProductPage> {
    await delay()
    let items = this.getStore()

    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim()
      items = items.filter((p) => matchesProductSearch(p, term))
    }

    if (filters.category && filters.category !== '') {
      items = items.filter((p) => p.category === filters.category)
    }

    const size = 5
    const start = page * size
    const paginated = items.slice(start, start + size)
    const hasNext = start + size < items.length

    return {
      items: paginated,
      page,
      size,
      hasNext,
    }
  }

  async create(input: ProductInput): Promise<Product> {
    await delay()

    const errors: Record<string, string> = {}

    if (!input.name || !input.name.trim()) {
      errors.name = 'El nombre del producto es obligatorio.'
    }

    const skuNormalized = (input.sku || '').trim().toUpperCase()
    if (!skuNormalized) {
      errors.sku = 'El código / SKU es obligatorio.'
    }

    if (!input.category) {
      errors.category = 'La categoría es obligatoria.'
    }

    if (input.sellingPriceCents === undefined || input.sellingPriceCents < 0) {
      errors.sellingPriceCents = 'El precio de venta debe ser mayor o igual a 0.'
    }

    if (input.purchasePriceCents !== undefined && input.purchasePriceCents < 0) {
      errors.purchasePriceCents = 'El precio de compra debe ser mayor o igual a 0.'
    }

    if (input.stock === undefined || input.stock < 0) {
      errors.stock = 'El stock inicial debe ser mayor o igual a 0.'
    }

    if (input.minStock === undefined || input.minStock < 0) {
      errors.minStock = 'El stock mínimo debe ser mayor o igual a 0.'
    }

    const currentStore = this.getStore()
    if (skuNormalized && currentStore.some((p) => p.sku === skuNormalized)) {
      errors.sku = `El código / SKU "${skuNormalized}" ya está registrado.`
    }

    if (Object.keys(errors).length > 0) {
      throw new InventoryApiError('Error de validación al registrar producto.', 'validation', errors)
    }

    nextPrdId += 1
    const now = new Date().toISOString()
    const newProduct: Product = {
      id: `prd-${nextPrdId}`,
      name: input.name.trim(),
      sku: skuNormalized,
      category: input.category,
      description: input.description?.trim() || undefined,
      purchasePriceCents: input.purchasePriceCents || 0,
      sellingPriceCents: input.sellingPriceCents,
      stock: input.stock,
      minStock: input.minStock,
      status: deriveProductStatus(input.stock, input.minStock),
      createdAt: now,
      updatedAt: now,
    }

    this.saveStore([newProduct, ...currentStore])
    return { ...newProduct }
  }

  async getMetrics(): Promise<InventoryMetrics> {
    await delay(100)
    const items = this.getStore()
    const totalProducts = items.length
    const lowStockCount = items.filter((p) => p.status === 'low').length
    const totalInventoryValueCents = items.reduce(
      (sum, p) => sum + p.stock * p.purchasePriceCents,
      0
    )

    return {
      totalProducts,
      lowStockCount,
      totalInventoryValueCents,
    }
  }

  async getAvailability(productId: string): Promise<number> {
    await delay(100)
    const items = this.getStore()
    const product = items.find((p) => p.id === productId)
    if (!product) {
      throw new InventoryApiError(`Producto con ID ${productId} no encontrado.`, 'not_found')
    }
    return product.stock
  }

  async consumeStock(lines: StockLineCommand[]): Promise<StockConsumptionResult> {
    await delay()
    const items = this.getStore()

    // 1. Verificación atómica de todas las líneas antes de mutar
    for (const line of lines) {
      const product = items.find((p) => p.id === line.productId)
      if (!product) {
        throw new InventoryApiError(`Producto no encontrado: ${line.productId}`, 'not_found')
      }
      if (product.stock < line.quantity) {
        throw new InventoryApiError(
          `Stock insuficiente para "${product.name}" (${product.sku}). Disponible: ${product.stock}, solicitado: ${line.quantity}.`,
          'insufficient_availability',
          {
            productId: product.id,
            available: String(product.stock),
            requested: String(line.quantity),
          }
        )
      }
    }

    // 2. Aplicación atómica de los descuentos
    const updated = items.map((product) => {
      const matchLine = lines.find((l) => l.productId === product.id)
      if (!matchLine) return product
      const newStock = product.stock - matchLine.quantity
      return {
        ...product,
        stock: newStock,
        status: deriveProductStatus(newStock, product.minStock),
        updatedAt: new Date().toISOString(),
      }
    })

    this.saveStore(updated)
    return {
      consumed: true,
      lines,
    }
  }
}

/** Permite reiniciar los almacenes del mock de inventario en pruebas */
export function resetInventoryMockStore(): void {
  initInventoryStores()
}
