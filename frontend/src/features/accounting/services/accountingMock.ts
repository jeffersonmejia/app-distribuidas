// SOLID: SRP - IMPLEMENTA UN REPOSITORIO SIMULADO DE LIBRO DIARIO AISLADO POR TENANT.

import type {
  AccountingSummary,
  JournalEntry,
  JournalEntryFilters,
  JournalEntryLine,
  JournalEntryPage,
  JournalEntryStatus,
} from '../types/accounting'
import { AccountingApiError, type AccountingRepository } from './accountingRepository'
import { MOCK_USER } from '../../identity/services/sessionMock'

const DEFAULT_TENANT_ID = MOCK_USER.tenantId
const PAGE_SIZE = 5
let latencyMs = 300

export function setAccountingMockLatency(ms: number): void {
  latencyMs = ms
}

interface SeedLine {
  accountCode: string
  accountName: string
  debitCents: number
  creditCents: number
}

interface SeedEntry {
  id: string
  code: string
  date: string
  glosa: string
  status: JournalEntryStatus
  lines: SeedLine[]
}

function buildLines(entryId: string, lines: SeedLine[]): JournalEntryLine[] {
  return lines.map((line, index) => ({ id: `${entryId}-l${index + 1}`, ...line }))
}

function buildEntry(seed: SeedEntry): JournalEntry {
  const timestamp = `${seed.date}T12:00:00.000Z`
  return {
    id: seed.id,
    code: seed.code,
    date: seed.date,
    glosa: seed.glosa,
    status: seed.status,
    lines: buildLines(seed.id, seed.lines),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

const ENTRIES_BY_TENANT: Record<string, JournalEntry[]> = {
  'tnt-andina-001': [
    buildEntry({
      id: 'je-andina-001',
      code: 'AS-2026-0412',
      date: '2026-11-18',
      glosa: 'Cobro de factura de cliente por venta de mercancía',
      status: 'POSTED',
      lines: [
        { accountCode: '1.1.01.001', accountName: 'Caja general', debitCents: 125000, creditCents: 0 },
        { accountCode: '1.1.02.003', accountName: 'Cuentas por cobrar clientes', debitCents: 0, creditCents: 125000 },
      ],
    }),
    buildEntry({
      id: 'je-andina-002',
      code: 'AS-2026-0413',
      date: '2026-11-17',
      glosa: 'Pago de nómina mensual administrativa',
      status: 'POSTED',
      lines: [
        { accountCode: '5.2.01.001', accountName: 'Sueldos y salarios', debitCents: 384000, creditCents: 0 },
        { accountCode: '1.1.01.002', accountName: 'Bancos cuenta corriente', debitCents: 0, creditCents: 384000 },
      ],
    }),
    buildEntry({
      id: 'je-andina-003',
      code: 'AS-2026-0414',
      date: '2026-11-16',
      glosa: 'Registro de venta al contado según comprobante',
      status: 'POSTED',
      lines: [
        { accountCode: '1.1.01.001', accountName: 'Caja general', debitCents: 89600, creditCents: 0 },
        { accountCode: '4.1.01.001', accountName: 'Ingresos por ventas', debitCents: 0, creditCents: 89600 },
      ],
    }),
    buildEntry({
      id: 'je-andina-004',
      code: 'AS-2026-0415',
      date: '2026-11-15',
      glosa: 'Compra de suministros de oficina a crédito',
      status: 'PENDING',
      lines: [
        { accountCode: '5.1.03.004', accountName: 'Suministros de oficina', debitCents: 45200, creditCents: 0 },
        { accountCode: '2.1.01.001', accountName: 'Cuentas por pagar proveedores', debitCents: 0, creditCents: 45200 },
      ],
    }),
    buildEntry({
      id: 'je-andina-005',
      code: 'AS-2026-0416',
      date: '2026-11-14',
      glosa: 'Pago de servicio de energía eléctrica',
      status: 'POSTED',
      lines: [
        { accountCode: '5.1.02.003', accountName: 'Servicios básicos', debitCents: 23800, creditCents: 0 },
        { accountCode: '1.1.01.002', accountName: 'Bancos cuenta corriente', debitCents: 0, creditCents: 23800 },
      ],
    }),
    buildEntry({
      id: 'je-andina-006',
      code: 'AS-2026-0417',
      date: '2026-11-13',
      glosa: 'Depósito de efectivo en cuenta bancaria',
      status: 'POSTED',
      lines: [
        { accountCode: '1.1.01.002', accountName: 'Bancos cuenta corriente', debitCents: 150000, creditCents: 0 },
        { accountCode: '1.1.01.001', accountName: 'Caja general', debitCents: 0, creditCents: 150000 },
      ],
    }),
    buildEntry({
      id: 'je-andina-007',
      code: 'AS-2026-0418',
      date: '2026-11-12',
      glosa: 'Reverso por anulación de asiento de provisión',
      status: 'REVERSED',
      lines: [
        { accountCode: '2.1.04.001', accountName: 'Provisiones por pagar', debitCents: 60000, creditCents: 0 },
        { accountCode: '5.1.05.002', accountName: 'Gastos operativos varios', debitCents: 0, creditCents: 60000 },
      ],
    }),
    buildEntry({
      id: 'je-andina-008',
      code: 'AS-2026-0419',
      date: '2026-11-11',
      glosa: 'Reconocimiento de ingreso por servicio prestado',
      status: 'PENDING',
      lines: [
        { accountCode: '1.1.02.005', accountName: 'Cuentas por cobrar servicios', debitCents: 72000, creditCents: 0 },
        { accountCode: '4.1.02.001', accountName: 'Ingresos por servicios', debitCents: 0, creditCents: 72000 },
      ],
    }),
    buildEntry({
      id: 'je-andina-009',
      code: 'AS-2026-0420',
      date: '2026-10-30',
      glosa: 'Pago a proveedor por compra de inventario',
      status: 'POSTED',
      lines: [
        { accountCode: '2.1.01.001', accountName: 'Cuentas por pagar proveedores', debitCents: 210000, creditCents: 0 },
        { accountCode: '1.1.01.002', accountName: 'Bancos cuenta corriente', debitCents: 0, creditCents: 210000 },
      ],
    }),
    buildEntry({
      id: 'je-andina-010',
      code: 'AS-2026-0421',
      date: '2026-10-28',
      glosa: 'Registro de depreciación mensual de equipo',
      status: 'POSTED',
      lines: [
        { accountCode: '5.1.06.001', accountName: 'Gasto depreciación equipos', debitCents: 18500, creditCents: 0 },
        { accountCode: '1.2.03.002', accountName: 'Depreciación acumulada equipos', debitCents: 0, creditCents: 18500 },
      ],
    }),
  ],
  'tnt-pacifico-002': [
    buildEntry({
      id: 'je-pacifico-001',
      code: 'AS-2026-0201',
      date: '2026-11-18',
      glosa: 'Cobro de servicio técnico al contado',
      status: 'POSTED',
      lines: [
        { accountCode: '1.1.01.001', accountName: 'Caja general', debitCents: 54000, creditCents: 0 },
        { accountCode: '4.1.02.001', accountName: 'Ingresos por servicios', debitCents: 0, creditCents: 54000 },
      ],
    }),
    buildEntry({
      id: 'je-pacifico-002',
      code: 'AS-2026-0202',
      date: '2026-11-16',
      glosa: 'Pago de arriendo de local comercial',
      status: 'POSTED',
      lines: [
        { accountCode: '5.1.01.001', accountName: 'Gasto arriendo', debitCents: 120000, creditCents: 0 },
        { accountCode: '1.1.01.002', accountName: 'Bancos cuenta corriente', debitCents: 0, creditCents: 120000 },
      ],
    }),
    buildEntry({
      id: 'je-pacifico-003',
      code: 'AS-2026-0203',
      date: '2026-11-14',
      glosa: 'Compra de materiales con pago diferido',
      status: 'PENDING',
      lines: [
        { accountCode: '1.1.03.001', accountName: 'Inventario de materiales', debitCents: 76000, creditCents: 0 },
        { accountCode: '2.1.01.001', accountName: 'Cuentas por pagar proveedores', debitCents: 0, creditCents: 76000 },
      ],
    }),
    buildEntry({
      id: 'je-pacifico-004',
      code: 'AS-2026-0204',
      date: '2026-11-12',
      glosa: 'Reverso de asiento por error de registro',
      status: 'REVERSED',
      lines: [
        { accountCode: '1.1.01.002', accountName: 'Bancos cuenta corriente', debitCents: 33000, creditCents: 0 },
        { accountCode: '1.1.02.001', accountName: 'Cuentas por cobrar clientes', debitCents: 0, creditCents: 33000 },
      ],
    }),
    buildEntry({
      id: 'je-pacifico-005',
      code: 'AS-2026-0205',
      date: '2026-11-10',
      glosa: 'Pago de servicios públicos del local',
      status: 'POSTED',
      lines: [
        { accountCode: '5.1.02.003', accountName: 'Servicios básicos', debitCents: 19800, creditCents: 0 },
        { accountCode: '1.1.01.001', accountName: 'Caja general', debitCents: 0, creditCents: 19800 },
      ],
    }),
    buildEntry({
      id: 'je-pacifico-006',
      code: 'AS-2026-0206',
      date: '2026-11-08',
      glosa: 'Registro de venta a crédito',
      status: 'PENDING',
      lines: [
        { accountCode: '1.1.02.001', accountName: 'Cuentas por cobrar clientes', debitCents: 88500, creditCents: 0 },
        { accountCode: '4.1.01.001', accountName: 'Ingresos por ventas', debitCents: 0, creditCents: 88500 },
      ],
    }),
    buildEntry({
      id: 'je-pacifico-007',
      code: 'AS-2026-0207',
      date: '2026-10-29',
      glosa: 'Pago de nómina operativa',
      status: 'POSTED',
      lines: [
        { accountCode: '5.2.01.001', accountName: 'Sueldos y salarios', debitCents: 245000, creditCents: 0 },
        { accountCode: '1.1.01.002', accountName: 'Bancos cuenta corriente', debitCents: 0, creditCents: 245000 },
      ],
    }),
    buildEntry({
      id: 'je-pacifico-008',
      code: 'AS-2026-0208',
      date: '2026-10-25',
      glosa: 'Ajuste por conciliación bancaria',
      status: 'POSTED',
      lines: [
        { accountCode: '5.1.05.002', accountName: 'Gastos operativos varios', debitCents: 1200, creditCents: 0 },
        { accountCode: '1.1.01.002', accountName: 'Bancos cuenta corriente', debitCents: 0, creditCents: 1200 },
      ],
    }),
  ],
}

let tenantStores = new Map<string, JournalEntry[]>()

function cloneEntry(entry: JournalEntry): JournalEntry {
  return { ...entry, lines: entry.lines.map((line) => ({ ...line })) }
}

function initStores(): void {
  tenantStores = new Map<string, JournalEntry[]>()
  for (const [tenantId, entries] of Object.entries(ENTRIES_BY_TENANT)) {
    tenantStores.set(tenantId, entries.map(cloneEntry))
  }
}

initStores()

function delay(ms = latencyMs): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function validatePage(page: number): void {
  if (!Number.isInteger(page) || page < 0) {
    throw new AccountingApiError('La página solicitada no es válida.', 'validation')
  }
}

function periodFromDate(date: string): string {
  return date.slice(0, 7)
}

function totalDebit(entry: JournalEntry): number {
  return entry.lines.reduce((sum, line) => sum + line.debitCents, 0)
}

function totalCredit(entry: JournalEntry): number {
  return entry.lines.reduce((sum, line) => sum + line.creditCents, 0)
}

// SOLID: SRP - EXPONE CONSULTAS DE LIBRO DIARIO SIN PERMITIR MUTACIONES.
export class AccountingMockRepository implements AccountingRepository {
  private explicitTenantId?: string

  constructor(explicitTenantId?: string) {
    this.explicitTenantId = explicitTenantId
  }

  private getTenantId(): string {
    return this.explicitTenantId ?? DEFAULT_TENANT_ID
  }

  private getStore(): JournalEntry[] {
    const tenantId = this.getTenantId()
    if (!tenantStores.has(tenantId)) {
      tenantStores.set(tenantId, [])
    }
    return tenantStores.get(tenantId)!
  }

  async listEntries(filters: JournalEntryFilters = {}, page = 0): Promise<JournalEntryPage> {
    await delay()
    validatePage(page)
    let items = this.getStore().map(cloneEntry)

    const search = filters.search?.trim().toLowerCase()
    if (search) {
      items = items.filter((entry) => {
        const inHeader =
          entry.code.toLowerCase().includes(search) ||
          entry.glosa.toLowerCase().includes(search) ||
          entry.date.includes(search)
        const inLines = entry.lines.some(
          (line) =>
            line.accountCode.toLowerCase().includes(search) ||
            line.accountName.toLowerCase().includes(search)
        )
        return inHeader || inLines
      })
    }

    const period = filters.period?.trim()
    if (period) {
      items = items.filter((entry) => periodFromDate(entry.date) === period)
    }

    items.sort((a, b) => b.date.localeCompare(a.date) || b.code.localeCompare(a.code))
    const start = page * PAGE_SIZE
    const pageItems = items.slice(start, start + PAGE_SIZE)
    return { items: pageItems, page, size: PAGE_SIZE, hasNext: start + PAGE_SIZE < items.length }
  }

  async getEntry(id: string): Promise<JournalEntry> {
    await delay()
    const entry = this.getStore().find((item) => item.id === id)
    if (!entry) {
      throw new AccountingApiError('Asiento contable no encontrado.', 'not_found')
    }
    return cloneEntry(entry)
  }

  async getSummary(): Promise<AccountingSummary> {
    await delay()
    const items = this.getStore()
    return {
      totalEntries: items.length,
      totalDebitCents: items.reduce((sum, entry) => sum + totalDebit(entry), 0),
      totalCreditCents: items.reduce((sum, entry) => sum + totalCredit(entry), 0),
      pendingEntries: items.filter((entry) => entry.status === 'PENDING').length,
    }
  }
}

export function resetAccountingMockStore(): void {
  latencyMs = 300
  initStores()
}
