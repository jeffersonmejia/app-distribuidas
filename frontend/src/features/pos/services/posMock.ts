// SOLID: SRP — REPOSITORIO EN MEMORIA PARA LA GESTIÓN DE VENTAS CON AISLAMIENTO MULTITENANT, FECHAS RELATIVAS Y PAGINACIÓN.

import type {
  Sale,
  SaleFilters,
  SalePage,
  SaleMetrics,
  SaleLine,
  SaleStatus,
  SaleType,
  CreateSaleInput,
} from '../types/sale'
import { PosApiError, type PosRepository } from './posRepository'
import { calcLineSubtotal, calcSaleTotals } from '../utils/calculations'
import { MOCK_USER } from '../../identity/services/sessionMock'
import { InventoryMockRepository } from '../../inventory/services/inventoryMock'
import {
  InventoryApiError,
  type InventoryRepository,
} from '../../inventory/services/inventoryRepository'
import type { Product } from '../../inventory/types/product'

const DEFAULT_TENANT_ID = MOCK_USER.tenantId

export type DateProvider = () => Date

/** Genera una cadena YYYY-MM-DD determinista para evitar desfases de huso horario */
function formatIsoCalendarDate(year: number, monthIdx: number, day: number): string {
  const mm = String(monthIdx + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

/**
 * FÓRMULAS DE MÉTRICAS FINANCIERAS (ACID & CONSISTENCIA):
 *
 * 1. Ventas del mes (totalSalesThisMonthCents):
 *    Suma del importe total (totalCents) de todas las ventas emitidas dentro del año y mes en curso
 *    (según nowFn()). No incluye ventas de meses anteriores.
 *
 * 2. Por cobrar (pendingCents):
 *    Suma del importe total (totalCents) de todos los comprobantes con estado 'pending' (pendientes de cobro),
 *    sin importar si fueron emitidos en el mes en curso o periodos previos.
 *
 * 3. Vencidas (overdueCents):
 *    Suma del importe total (totalCents) de todas las facturas con estado 'overdue' (facturas vencidas no saldadas).
 *
 * 4. Conteo por estado (countByStatus):
 *    Distribución exacta de comprobantes registrados por estado: paid, pending y overdue.
 */
function buildMockSalesByTenant(now: Date): Record<string, Sale[]> {
  const y = now.getFullYear()
  const m = now.getMonth()

  const prevYear = m === 0 ? y - 1 : y
  const prevMonth = m === 0 ? 11 : m - 1

  return {
    'tnt-andina-001': [
      // 1. Venta mes en curso (Pagada)
      {
        id: 'sal-andina-001',
        receiptNumber: '001-001-000000101',
        type: 'Factura Electrónica',
        customerName: 'Constructora del Valle S.A.',
        customerIdentification: '1792019482001',
        issuedAt: formatIsoCalendarDate(y, m, 18),
        paymentMethod: 'Transferencia',
        status: 'paid',
        lines: [
          {
            productId: 'prd-andina-001',
            name: 'Cemento Portland Tipo I (50kg)',
            sku: 'MAT-2026-081',
            quantity: 20,
            unitPriceCents: 850,
            subtotalCents: 17000,
          },
          {
            productId: 'prd-andina-002',
            name: 'Varilla de Acero Corrugado 12mm',
            sku: 'MAT-2026-044',
            quantity: 10,
            unitPriceCents: 1420,
            subtotalCents: 14200,
          },
        ],
        ...calcSaleTotals([
          {
            productId: 'prd-andina-001',
            name: 'Cemento Portland Tipo I (50kg)',
            sku: 'MAT-2026-081',
            quantity: 20,
            unitPriceCents: 850,
            subtotalCents: 17000,
          },
          {
            productId: 'prd-andina-002',
            name: 'Varilla de Acero Corrugado 12mm',
            sku: 'MAT-2026-044',
            quantity: 10,
            unitPriceCents: 1420,
            subtotalCents: 14200,
          },
        ]),
      },
      // 2. Venta mes en curso (Pendiente)
      {
        id: 'sal-andina-002',
        receiptNumber: '001-001-000000102',
        type: 'Factura Electrónica',
        customerName: 'Ingeniería & Proyectos Andinos Cía.',
        customerIdentification: '1791845239001',
        issuedAt: formatIsoCalendarDate(y, m, 17),
        paymentMethod: 'Transferencia',
        status: 'pending',
        lines: [
          {
            productId: 'prd-andina-003',
            name: 'Taladro Percutor Industrial 850W',
            sku: 'EQP-2026-112',
            quantity: 2,
            unitPriceCents: 8990,
            subtotalCents: 17980,
          },
        ],
        ...calcSaleTotals([
          {
            productId: 'prd-andina-003',
            name: 'Taladro Percutor Industrial 850W',
            sku: 'EQP-2026-112',
            quantity: 2,
            unitPriceCents: 8990,
            subtotalCents: 17980,
          },
        ]),
      },
      // 3. Venta mes en curso (Pagada)
      {
        id: 'sal-andina-003',
        receiptNumber: '001-001-000000103',
        type: 'Nota de Venta',
        customerName: 'Carlos Alberto Medina Loor',
        customerIdentification: '0918237465',
        issuedAt: formatIsoCalendarDate(y, m, 16),
        paymentMethod: 'Efectivo',
        status: 'paid',
        lines: [
          {
            productId: 'prd-andina-004',
            name: 'Disco de Corte Diamantado 7"',
            sku: 'HER-2026-095',
            quantity: 3,
            unitPriceCents: 1850,
            subtotalCents: 5550,
          },
        ],
        ...calcSaleTotals([
          {
            productId: 'prd-andina-004',
            name: 'Disco de Corte Diamantado 7"',
            sku: 'HER-2026-095',
            quantity: 3,
            unitPriceCents: 1850,
            subtotalCents: 5550,
          },
        ]),
      },
      // 4. Venta mes anterior (Vencida)
      {
        id: 'sal-andina-004',
        receiptNumber: '001-001-000000104',
        type: 'Factura Electrónica',
        customerName: 'Obras Civiles del Litoral S.A.',
        customerIdentification: '0992348571001',
        issuedAt: formatIsoCalendarDate(prevYear, prevMonth, 20),
        paymentMethod: 'Cheque',
        status: 'overdue',
        lines: [
          {
            productId: 'prd-andina-002',
            name: 'Varilla de Acero Corrugado 12mm',
            sku: 'MAT-2026-044',
            quantity: 25,
            unitPriceCents: 1420,
            subtotalCents: 35500,
          },
        ],
        ...calcSaleTotals([
          {
            productId: 'prd-andina-002',
            name: 'Varilla de Acero Corrugado 12mm',
            sku: 'MAT-2026-044',
            quantity: 25,
            unitPriceCents: 1420,
            subtotalCents: 35500,
          },
        ]),
      },
      // 5. Venta mes en curso (Pagada)
      {
        id: 'sal-andina-005',
        receiptNumber: '001-001-000000105',
        type: 'Factura Electrónica',
        customerName: 'Ferretería El Maestro Cía.',
        customerIdentification: '1790483921001',
        issuedAt: formatIsoCalendarDate(y, m, 15),
        paymentMethod: 'Tarjeta de Crédito',
        status: 'paid',
        lines: [
          {
            productId: 'prd-andina-001',
            name: 'Cemento Portland Tipo I (50kg)',
            sku: 'MAT-2026-081',
            quantity: 15,
            unitPriceCents: 850,
            subtotalCents: 12750,
          },
        ],
        ...calcSaleTotals([
          {
            productId: 'prd-andina-001',
            name: 'Cemento Portland Tipo I (50kg)',
            sku: 'MAT-2026-081',
            quantity: 15,
            unitPriceCents: 850,
            subtotalCents: 12750,
          },
        ]),
      },
      // 6. Venta mes en curso (Pagada)
      {
        id: 'sal-andina-006',
        receiptNumber: '001-001-000000106',
        type: 'Recibo',
        customerName: 'Mariana de Jesús Ramos',
        customerIdentification: '1712948573',
        issuedAt: formatIsoCalendarDate(y, m, 14),
        paymentMethod: 'Efectivo',
        status: 'paid',
        lines: [
          {
            productId: 'prd-andina-004',
            name: 'Disco de Corte Diamantado 7"',
            sku: 'HER-2026-095',
            quantity: 1,
            unitPriceCents: 1850,
            subtotalCents: 1850,
          },
        ],
        ...calcSaleTotals([
          {
            productId: 'prd-andina-004',
            name: 'Disco de Corte Diamantado 7"',
            sku: 'HER-2026-095',
            quantity: 1,
            unitPriceCents: 1850,
            subtotalCents: 1850,
          },
        ]),
      },
      // 7. Venta mes en curso (Pendiente)
      {
        id: 'sal-andina-007',
        receiptNumber: '001-001-000000107',
        type: 'Factura Electrónica',
        customerName: 'Consorcio Vial Sierra Norte',
        customerIdentification: '1091728394001',
        issuedAt: formatIsoCalendarDate(y, m, 13),
        paymentMethod: 'Transferencia',
        status: 'pending',
        lines: [
          {
            productId: 'prd-andina-002',
            name: 'Varilla de Acero Corrugado 12mm',
            sku: 'MAT-2026-044',
            quantity: 15,
            unitPriceCents: 1420,
            subtotalCents: 21300,
          },
        ],
        ...calcSaleTotals([
          {
            productId: 'prd-andina-002',
            name: 'Varilla de Acero Corrugado 12mm',
            sku: 'MAT-2026-044',
            quantity: 15,
            unitPriceCents: 1420,
            subtotalCents: 21300,
          },
        ]),
      },
      // 8. Venta mes anterior (Vencida)
      {
        id: 'sal-andina-008',
        receiptNumber: '001-001-000000108',
        type: 'Factura Electrónica',
        customerName: 'Desarrollos Habitacionales del Austro',
        customerIdentification: '0190384729001',
        issuedAt: formatIsoCalendarDate(prevYear, prevMonth, 10),
        paymentMethod: 'Transferencia',
        status: 'overdue',
        lines: [
          {
            productId: 'prd-andina-003',
            name: 'Taladro Percutor Industrial 850W',
            sku: 'EQP-2026-112',
            quantity: 1,
            unitPriceCents: 8990,
            subtotalCents: 8990,
          },
        ],
        ...calcSaleTotals([
          {
            productId: 'prd-andina-003',
            name: 'Taladro Percutor Industrial 850W',
            sku: 'EQP-2026-112',
            quantity: 1,
            unitPriceCents: 8990,
            subtotalCents: 8990,
          },
        ]),
      },
    ],
    'tnt-pacifico-002': [
      {
        id: 'sal-pacifico-001',
        receiptNumber: '002-001-000000001',
        type: 'Factura Electrónica',
        customerName: 'Naviera del Pacífico S.A.',
        customerIdentification: '0990011223001',
        issuedAt: formatIsoCalendarDate(y, m, 10),
        paymentMethod: 'Transferencia',
        status: 'paid',
        lines: [
          {
            productId: 'prd-pacifico-001',
            name: 'Pintura Epóxica de Alto Tráfico (Galón)',
            sku: 'MAT-2026-501',
            quantity: 5,
            unitPriceCents: 4500,
            subtotalCents: 22500,
          },
        ],
        ...calcSaleTotals([
          {
            productId: 'prd-pacifico-001',
            name: 'Pintura Epóxica de Alto Tráfico (Galón)',
            sku: 'MAT-2026-501',
            quantity: 5,
            unitPriceCents: 4500,
            subtotalCents: 22500,
          },
        ]),
      },
    ],
  }
}

let tenantStores = new Map<string, Sale[]>()
let activeDateProvider: DateProvider = () => new Date()

function initPosStores(nowFn?: DateProvider): void {
  if (nowFn) activeDateProvider = nowFn
  tenantStores = new Map<string, Sale[]>()
  const mockSeed = buildMockSalesByTenant(activeDateProvider())
  for (const [tId, seedList] of Object.entries(mockSeed)) {
    tenantStores.set(tId, seedList.map((s) => ({ ...s, lines: s.lines.map((l) => ({ ...l })) })))
  }
}

initPosStores()

function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function matchesSaleSearch(sale: Sale, search: string): boolean {
  const q = search.toLowerCase()
  return (
    sale.receiptNumber.toLowerCase().includes(q) ||
    sale.customerName.toLowerCase().includes(q) ||
    sale.customerIdentification.toLowerCase().includes(q)
  )
}

// SOLID: SRP — IMPLEMENTA EL REPOSITORIO DE VENTAS EN MEMORIA AISLADO POR ORGANIZACIÓN.
export class PosMockRepository implements PosRepository {
  private explicitTenantId?: string
  private nowFn: DateProvider
  private inventoryRepoOverride?: InventoryRepository

  constructor(
    explicitTenantId?: string,
    nowFn?: DateProvider,
    inventoryRepoOverride?: InventoryRepository
  ) {
    this.explicitTenantId = explicitTenantId
    this.nowFn = nowFn ?? activeDateProvider
    this.inventoryRepoOverride = inventoryRepoOverride
  }

  private getActiveTenant(): string {
    return this.explicitTenantId ?? DEFAULT_TENANT_ID
  }

  private getStore(): Sale[] {
    const tId = this.getActiveTenant()
    if (!tenantStores.has(tId)) {
      const mockSeed = buildMockSalesByTenant(this.nowFn())
      const seed = mockSeed[tId] ?? []
      tenantStores.set(tId, seed.map((s) => ({ ...s, lines: s.lines.map((l) => ({ ...l })) })))
    }
    return tenantStores.get(tId)!
  }

  async list(filters: SaleFilters = {}, page = 0): Promise<SalePage> {
    await delay()
    let items = this.getStore()

    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim()
      items = items.filter((s) => matchesSaleSearch(s, term))
    }

    if (filters.status) {
      items = items.filter((s) => s.status === filters.status)
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

  async getById(id: string): Promise<Sale> {
    await delay()
    const items = this.getStore()
    const sale = items.find((s) => s.id === id)
    if (!sale) {
      throw new PosApiError(`Venta con identificador "${id}" no encontrada`, 'not_found')
    }
    return {
      ...sale,
      lines: sale.lines.map((l) => ({ ...l })),
    }
  }

  async getMetrics(): Promise<SaleMetrics> {
    await delay()
    const items = this.getStore()
    const now = this.nowFn()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    let totalSalesThisMonthCents = 0
    let pendingCents = 0
    let overdueCents = 0
    const countByStatus: Record<SaleStatus, number> = {
      paid: 0,
      pending: 0,
      overdue: 0,
    }

    for (const sale of items) {
      countByStatus[sale.status] = (countByStatus[sale.status] ?? 0) + 1

      // 1. Extraer año y mes de la emisión tratando YYYY-MM-DD como fecha local sin desfase UTC
      const match = sale.issuedAt.match(/^(\d{4})-(\d{2})/)
      const saleYear = match ? parseInt(match[1], 10) : new Date(sale.issuedAt).getFullYear()
      const saleMonth = match ? parseInt(match[2], 10) - 1 : new Date(sale.issuedAt).getMonth()

      // FÓRMULA 1: Ventas del mes (suma exclusivamente las emitidas en el año y mes en curso)
      if (saleYear === currentYear && saleMonth === currentMonth) {
        totalSalesThisMonthCents += sale.totalCents
      }

      // FÓRMULA 2: Por cobrar (suma de todos los comprobantes con estado 'pending')
      if (sale.status === 'pending') {
        pendingCents += sale.totalCents
      }

      // FÓRMULA 3: Vencidas (suma de todas las facturas con estado 'overdue')
      if (sale.status === 'overdue') {
        overdueCents += sale.totalCents
      }
    }

    return {
      totalSalesThisMonthCents,
      pendingCents,
      overdueCents,
      countByStatus,
    }
  }

  // SOLID: SRP — CREA UNA VENTA VALIDANDO ENTRADAS, RECALCULANDO IMPORTES Y APLICANDO DESCUENTO ATÓMICO EN INVENTARIO.
  async createSale(input: CreateSaleInput): Promise<Sale> {
    await delay()

    // 1. Validaciones de cliente
    if (!input.customerName || !input.customerName.trim()) {
      throw new PosApiError('El nombre o razón social del cliente es obligatorio.', 'validation', {
        customerName: 'El nombre o razón social del cliente es obligatorio.',
      })
    }
    if (!input.customerIdentification || !input.customerIdentification.trim()) {
      throw new PosApiError('La identificación (RUC o cédula) del cliente es obligatoria.', 'validation', {
        customerIdentification: 'La identificación (RUC o cédula) del cliente es obligatoria.',
      })
    }

    // 2. Validaciones de líneas
    if (!input.lines || input.lines.length === 0) {
      throw new PosApiError('La venta debe incluir al menos una línea de producto.', 'validation', {
        lines: 'La venta debe incluir al menos una línea de producto.',
      })
    }

    for (const [idx, line] of input.lines.entries()) {
      if (!line.productId || !line.productId.trim()) {
        throw new PosApiError(`La línea ${idx + 1} no tiene un producto seleccionado.`, 'validation', {
          [`lines.${idx}.productId`]: 'Producto requerido.',
        })
      }
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        throw new PosApiError(`La cantidad en la línea ${idx + 1} debe ser un entero mayor a 0.`, 'validation', {
          [`lines.${idx}.quantity`]: 'La cantidad debe ser un entero mayor a 0.',
        })
      }
    }

    // 3. Validación de descuento
    if (input.discountCents !== undefined) {
      if (input.discountCents < 0 || !Number.isInteger(input.discountCents)) {
        throw new PosApiError('El descuento comercial debe ser un valor entero no negativo.', 'validation', {
          discountCents: 'El descuento comercial no puede ser negativo.',
        })
      }
    }

    const inventoryRepo =
      this.inventoryRepoOverride ?? new InventoryMockRepository(this.getActiveTenant())

    // 4. Verificación y recalculación de líneas con datos reales del catálogo (no confía en importes del cliente)
    const recalculatedLines: SaleLine[] = []
    for (const line of input.lines) {
      let product: Product | null = null
      if (inventoryRepo.getById) {
        try {
          product = await inventoryRepo.getById(line.productId)
        } catch {
          product = null
        }
      }
      if (!product) {
        throw new PosApiError(`Producto con ID "${line.productId}" no encontrado en inventario.`, 'not_found', {
          productId: line.productId,
        })
      }

      const unitPriceCents =
        line.unitPriceCents !== undefined && line.unitPriceCents >= 0
          ? Math.round(line.unitPriceCents)
          : product.sellingPriceCents

      const subtotalCents = calcLineSubtotal(line.quantity, unitPriceCents)

      recalculatedLines.push({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity: line.quantity,
        unitPriceCents,
        subtotalCents,
      })
    }

    // 5. Orquestación atómica: descontar stock en inventario
    // Si el stock es insuficiente o falla, consumeStock lanza error y se propaga; la venta NO se crea (ACID)
    try {
      if (inventoryRepo.consumeStock) {
        await inventoryRepo.consumeStock(
          recalculatedLines.map((l) => ({ productId: l.productId, quantity: l.quantity }))
        )
      }
    } catch (err) {
      if (err instanceof InventoryApiError) {
        throw new PosApiError(
          err.message,
          err.kind === 'insufficient_availability' ? 'insufficient_availability' : 'validation',
          err.details
        )
      }
      throw err
    }

    // 6. Recálculo del resumen con IVA 15% HALF_UP y descuento
    const totals = calcSaleTotals(recalculatedLines, input.discountCents ?? 0)

    // 7. Determinación de estado según forma de pago
    // 'Crédito 30 días' -> 'pending', resto ('Efectivo', 'Transferencia', 'Transferencia bancaria') -> 'paid'
    const status: SaleStatus = input.paymentMethod === 'Crédito 30 días' ? 'pending' : 'paid'

    // 8. Generación de número secuencial determinista
    const store = this.getStore()
    let maxNum = 105
    for (const s of store) {
      const match = s.receiptNumber.match(/001-001-(\d+)/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNum) maxNum = num
      }
    }
    const nextNum = maxNum + 1
    const receiptNumber = `001-001-${String(nextNum).padStart(9, '0')}`

    const now = this.nowFn()
    const issuedAt =
      input.issuedAt?.trim() ||
      formatIsoCalendarDate(now.getFullYear(), now.getMonth(), now.getDate())

    const type: SaleType = input.type ?? 'Factura Electrónica'

    const newSale: Sale = {
      id: `sal-${this.getActiveTenant()}-${nextNum}`,
      receiptNumber,
      type,
      customerName: input.customerName.trim(),
      customerIdentification: input.customerIdentification.trim(),
      issuedAt,
      paymentMethod: input.paymentMethod,
      status,
      lines: recalculatedLines,
      subtotal0Cents: totals.subtotal0Cents,
      subtotalGravadoCents: totals.subtotalGravadoCents,
      discountCents: totals.discountCents,
      ivaCents: totals.ivaCents,
      totalCents: totals.totalCents,
      notes: input.notes?.trim() || undefined,
    }

    store.unshift(newSale)
    return {
      ...newSale,
      lines: newSale.lines.map((l) => ({ ...l })),
    }
  }
}

/** Permite reiniciar los almacenes del mock de ventas en pruebas con una fecha inyectable */
export function resetPosMockStore(nowFn?: DateProvider): void {
  initPosStores(nowFn)
}
