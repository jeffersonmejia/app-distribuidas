// SOLID: SRP — REPOSITORIO EN MEMORIA PARA LA GESTIÓN DE VENTAS CON AISLAMIENTO MULTITENANT Y PAGINACIÓN.

import type {
  Sale,
  SaleFilters,
  SalePage,
  SaleMetrics,
  SaleInput,
} from '../types/sale'
import { PosApiError, type PosRepository } from './posRepository'
import { calcSaleTotals } from '../utils/calculations'
import { MOCK_USER } from '../../identity/services/sessionMock'

const DEFAULT_TENANT_ID = MOCK_USER.tenantId

const MOCK_SALES_BY_TENANT: Record<string, Sale[]> = {
  'tnt-andina-001': [
    {
      id: 'sal-andina-001',
      receiptNumber: '001-001-000000101',
      type: 'Factura Electrónica',
      customerName: 'Constructora del Valle S.A.',
      customerIdentification: '1792019482001',
      issuedAt: '2026-02-18T10:30:00Z',
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
    {
      id: 'sal-andina-002',
      receiptNumber: '001-001-000000102',
      type: 'Factura Electrónica',
      customerName: 'Ingeniería & Proyectos Andinos Cía.',
      customerIdentification: '1791845239001',
      issuedAt: '2026-02-17T15:45:00Z',
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
    {
      id: 'sal-andina-003',
      receiptNumber: '001-001-000000103',
      type: 'Nota de Venta',
      customerName: 'Carlos Alberto Medina Loor',
      customerIdentification: '0918237465',
      issuedAt: '2026-02-16T11:20:00Z',
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
    {
      id: 'sal-andina-004',
      receiptNumber: '001-001-000000104',
      type: 'Factura Electrónica',
      customerName: 'Obras Civiles del Litoral S.A.',
      customerIdentification: '0992348571001',
      issuedAt: '2026-01-20T09:15:00Z',
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
    {
      id: 'sal-andina-005',
      receiptNumber: '001-001-000000105',
      type: 'Factura Electrónica',
      customerName: 'Ferretería El Maestro Cía.',
      customerIdentification: '1790483921001',
      issuedAt: '2026-02-15T14:10:00Z',
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
    {
      id: 'sal-andina-006',
      receiptNumber: '001-001-000000106',
      type: 'Recibo',
      customerName: 'Mariana de Jesús Ramos',
      customerIdentification: '1712948573',
      issuedAt: '2026-02-14T16:50:00Z',
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
    {
      id: 'sal-andina-007',
      receiptNumber: '001-001-000000107',
      type: 'Factura Electrónica',
      customerName: 'Consorcio Vial Sierra Norte',
      customerIdentification: '1091728394001',
      issuedAt: '2026-02-13T12:00:00Z',
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
    {
      id: 'sal-andina-008',
      receiptNumber: '001-001-000000108',
      type: 'Factura Electrónica',
      customerName: 'Desarrollos Habitacionales del Austro',
      customerIdentification: '0190384729001',
      issuedAt: '2026-01-10T08:30:00Z',
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
      issuedAt: '2026-02-10T10:00:00Z',
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

let tenantStores = new Map<string, Sale[]>()

function initPosStores(): void {
  tenantStores = new Map<string, Sale[]>()
  for (const [tId, seedList] of Object.entries(MOCK_SALES_BY_TENANT)) {
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

  constructor(explicitTenantId?: string) {
    this.explicitTenantId = explicitTenantId
  }

  private getActiveTenant(): string {
    return this.explicitTenantId ?? DEFAULT_TENANT_ID
  }

  private getStore(): Sale[] {
    const tId = this.getActiveTenant()
    if (!tenantStores.has(tId)) {
      const seed = MOCK_SALES_BY_TENANT[tId] ?? []
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

    let totalSalesThisMonthCents = 0
    let pendingCents = 0
    let overdueCents = 0
    const countByStatus: Record<string, number> = {
      paid: 0,
      pending: 0,
      overdue: 0,
    }

    for (const sale of items) {
      countByStatus[sale.status] = (countByStatus[sale.status] ?? 0) + 1
      if (sale.status === 'paid') {
        totalSalesThisMonthCents += sale.totalCents
      } else if (sale.status === 'pending') {
        pendingCents += sale.totalCents
      } else if (sale.status === 'overdue') {
        overdueCents += sale.totalCents
      }
    }

    return {
      totalSalesThisMonthCents,
      pendingCents,
      overdueCents,
      countByStatus: {
        paid: countByStatus.paid ?? 0,
        pending: countByStatus.pending ?? 0,
        overdue: countByStatus.overdue ?? 0,
      },
    }
  }

  async createSale(_input: SaleInput): Promise<Sale> {
    await delay()
    throw new PosApiError('Creación de ventas desde POS no implementada en este alcance.', 'service_unavailable')
  }
}

/** Permite reiniciar los almacenes del mock de ventas en pruebas */
export function resetPosMockStore(): void {
  initPosStores()
}
