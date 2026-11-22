import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  AccountingApiError,
  AccountingMockRepository,
  getAccountingRepository,
  resetAccountingMockStore,
  setAccountingMockLatency,
  setAccountingRepositoryForTesting,
} from './index'

describe('AccountingMockRepository', () => {
  let repo: AccountingMockRepository

  beforeEach(() => {
    resetAccountingMockStore()
    setAccountingMockLatency(0)
    repo = new AccountingMockRepository()
  })

  afterEach(() => {
    setAccountingMockLatency(300)
  })

  it('lista asientos paginados con tamaño máximo de 5', async () => {
    const page0 = await repo.listEntries({}, 0)
    expect(page0.size).toBe(5)
    expect(page0.items).toHaveLength(5)
    expect(page0.hasNext).toBe(true)

    const page1 = await repo.listEntries({}, 1)
    expect(page1.items).toHaveLength(5)
    expect(page1.hasNext).toBe(false)
  })

  it('filtra por búsqueda y período', async () => {
    const search = await repo.listEntries({ search: 'nómina' })
    expect(search.items).toHaveLength(1)
    expect(search.items[0].code).toBe('AS-2026-0413')

    const period = await repo.listEntries({ period: '2026-10' })
    expect(period.items.length).toBeGreaterThan(0)
    expect(period.items.every((entry) => entry.date.startsWith('2026-10'))).toBe(true)
  })

  it('obtiene un asiento y calcula resumen', async () => {
    const entry = await repo.getEntry('je-andina-001')
    expect(entry.code).toBe('AS-2026-0412')

    const summary = await repo.getSummary()
    expect(summary.totalEntries).toBe(10)
    expect(summary.pendingEntries).toBe(2)
    expect(summary.totalDebitCents).toBe(summary.totalCreditCents)
  })

  it('mantiene todos los asientos mock balanceados', async () => {
    const tenants = ['tnt-andina-001', 'tnt-pacifico-002']
    for (const tenantId of tenants) {
      const tenantRepo = new AccountingMockRepository(tenantId)
      const page0 = await tenantRepo.listEntries({}, 0)
      const page1 = await tenantRepo.listEntries({}, 1)
      const entries = [...page0.items, ...page1.items]
      expect(entries.length).toBeGreaterThanOrEqual(8)
      for (const entry of entries) {
        const debit = entry.lines.reduce((sum, line) => sum + line.debitCents, 0)
        const credit = entry.lines.reduce((sum, line) => sum + line.creditCents, 0)
        expect(debit).toBe(credit)
        expect(debit).toBeGreaterThan(0)
      }
    }
  })

  it('mantiene aislamiento por tenant y rechaza id inexistente', async () => {
    const pacifico = new AccountingMockRepository('tnt-pacifico-002')
    const andina = await repo.listEntries()
    const pacificoEntries = await pacifico.listEntries()
    expect(andina.items.some((e) => e.id.startsWith('je-andina-'))).toBe(true)
    expect(pacificoEntries.items.every((e) => e.id.startsWith('je-pacifico-'))).toBe(true)

    await expect(pacifico.getEntry('je-andina-001')).rejects.toMatchObject({
      kind: 'not_found',
    })
  })
})

describe('getAccountingRepository', () => {
  beforeEach(() => {
    setAccountingRepositoryForTesting(null)
  })

  it('rechaza con error seguro cuando la fuente es api', async () => {
    const original = import.meta.env.VITE_DATA_SOURCE
    import.meta.env.VITE_DATA_SOURCE = 'api'
    setAccountingRepositoryForTesting(null)
    const apiRepo = getAccountingRepository()
    await expect(apiRepo.listEntries()).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof AccountingApiError &&
        err.kind === 'service_unavailable' &&
        err.message === 'No se pudo conectar con Accounting.'
      )
    })
    import.meta.env.VITE_DATA_SOURCE = original
  })
})
