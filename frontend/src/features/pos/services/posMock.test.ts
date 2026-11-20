import { describe, it, expect, beforeEach } from 'vitest'
import { PosMockRepository, resetPosMockStore } from './posMock'
import { PosApiError } from './posRepository'

describe('PosMockRepository', () => {
  let repo: PosMockRepository

  beforeEach(() => {
    resetPosMockStore()
    repo = new PosMockRepository()
  })

  it('lista ventas paginadas con tamaño máximo de 5', async () => {
    const page0 = await repo.list({}, 0)
    expect(page0.size).toBe(5)
    expect(page0.items.length).toBe(5)
    expect(page0.hasNext).toBe(true)

    const page1 = await repo.list({}, 1)
    expect(page1.items.length).toBe(3) // 8 en total para andina
    expect(page1.hasNext).toBe(false)
  })

  it('filtra por término de búsqueda en número de comprobante, cliente o RUC', async () => {
    const resReceipt = await repo.list({ search: '000000101' })
    expect(resReceipt.items.length).toBe(1)
    expect(resReceipt.items[0].receiptNumber).toBe('001-001-000000101')

    const resCustomer = await repo.list({ search: 'Constructora' })
    expect(resCustomer.items.length).toBe(1)
    expect(resCustomer.items[0].customerName).toContain('Constructora del Valle')

    const resRuc = await repo.list({ search: '1792019482001' })
    expect(resRuc.items.length).toBe(1)
    expect(resRuc.items[0].customerIdentification).toBe('1792019482001')
  })

  it('filtra por estado de venta', async () => {
    const paid = await repo.list({ status: 'paid' })
    expect(paid.items.every((s) => s.status === 'paid')).toBe(true)

    const pending = await repo.list({ status: 'pending' })
    expect(pending.items.every((s) => s.status === 'pending')).toBe(true)

    const overdue = await repo.list({ status: 'overdue' })
    expect(overdue.items.every((s) => s.status === 'overdue')).toBe(true)
  })

  it('obtiene una venta por su id', async () => {
    const sale = await repo.getById('sal-andina-001')
    expect(sale.id).toBe('sal-andina-001')
    expect(sale.lines.length).toBeGreaterThan(0)
  })

  it('arroja PosApiError con kind not_found si el id no existe', async () => {
    await expect(repo.getById('id-inexistente')).rejects.toThrow(PosApiError)
    try {
      await repo.getById('id-inexistente')
    } catch (err) {
      expect((err as PosApiError).kind).toBe('not_found')
    }
  })

  it('calcula métricas de ventas agregadas para el tenant', async () => {
    const metrics = await repo.getMetrics()
    expect(metrics.totalSalesThisMonthCents).toBeGreaterThan(0)
    expect(metrics.pendingCents).toBeGreaterThan(0)
    expect(metrics.overdueCents).toBeGreaterThan(0)
    expect(metrics.countByStatus.paid).toBe(4)
    expect(metrics.countByStatus.pending).toBe(2)
    expect(metrics.countByStatus.overdue).toBe(2)
  })

  it('respeta el aislamiento estricto por tenant', async () => {
    const repoPacifico = new PosMockRepository('tnt-pacifico-002')
    const pacificoSales = await repoPacifico.list()
    expect(pacificoSales.items.length).toBe(1)
    expect(pacificoSales.items[0].receiptNumber).toBe('002-001-000000001')

    await expect(repoPacifico.getById('sal-andina-001')).rejects.toThrow(PosApiError)
  })
})
