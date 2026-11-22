import { describe, it, expect, beforeEach } from 'vitest'
import { PosMockRepository, resetPosMockStore } from './posMock'
import { PosApiError } from './posRepository'
import {
  InventoryMockRepository,
  resetInventoryMockStore,
} from '../../inventory/services/inventoryMock'

describe('PosMockRepository', () => {
  let repo: PosMockRepository
  const fixedNow = () => new Date(2026, 10, 15) // 15 de noviembre de 2026

  beforeEach(() => {
    resetPosMockStore(fixedNow)
    resetInventoryMockStore()
    repo = new PosMockRepository(undefined, fixedNow)
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

  it('genera fechas de emisión relativas al mes actual y anterior de forma determinista', async () => {
    const allSales = await repo.list({}, 0)
    const page1 = await repo.list({}, 1)
    const items = [...allSales.items, ...page1.items]

    // Comprobantes del mes en curso (noviembre 2026)
    const currentMonthSales = items.filter((s) => s.issuedAt!.startsWith('2026-11'))
    expect(currentMonthSales.length).toBe(6)

    // Comprobantes del mes anterior (octubre 2026) con estado overdue
    const prevMonthSales = items.filter((s) => s.issuedAt!.startsWith('2026-10'))
    expect(prevMonthSales.length).toBe(2)
    expect(prevMonthSales.every((s) => s.status === 'overdue')).toBe(true)
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

  it('aplica las fórmulas exactas de métricas: Ventas del mes solo mes actual, Por cobrar pendientes y Vencidas estado overdue', async () => {
    const metrics = await repo.getMetrics()
    const allSales0 = await repo.list({}, 0)
    const allSales1 = await repo.list({}, 1)
    const allSales = [...allSales0.items, ...allSales1.items]

    // 1. Ventas del mes = suma exclusiva de comprobantes emitidos en el mes en curso (2026-11)
    const expectedCurrentMonthCents = allSales
      .filter((s) => s.issuedAt!.startsWith('2026-11'))
      .reduce((sum, s) => sum + s.totalCents, 0)
    expect(metrics.totalSalesThisMonthCents).toBe(expectedCurrentMonthCents)

    // Las facturas vencidas de octubre NO deben estar en Ventas del mes
    const overdueSales = allSales.filter((s) => s.status === 'overdue')
    const overdueTotal = overdueSales.reduce((sum, s) => sum + s.totalCents, 0)
    expect(metrics.totalSalesThisMonthCents).not.toContain(overdueTotal)

    // 2. Por cobrar = suma de todas las facturas pendientes
    const expectedPendingCents = allSales
      .filter((s) => s.status === 'pending')
      .reduce((sum, s) => sum + s.totalCents, 0)
    expect(metrics.pendingCents).toBe(expectedPendingCents)

    // 3. Vencidas = suma de todas las facturas con estado overdue
    expect(metrics.overdueCents).toBe(overdueTotal)

    // 4. Conteo por estado
    expect(metrics.countByStatus.paid).toBe(4)
    expect(metrics.countByStatus.pending).toBe(2)
    expect(metrics.countByStatus.overdue).toBe(2)
  })

  it('respeta el aislamiento estricto por tenant', async () => {
    const repoPacifico = new PosMockRepository('tnt-pacifico-002', fixedNow)
    const pacificoSales = await repoPacifico.list()
    expect(pacificoSales.items.length).toBe(1)
    expect(pacificoSales.items[0].receiptNumber).toBe('002-001-000000001')

    await expect(repoPacifico.getById('sal-andina-001')).rejects.toThrow(PosApiError)
  })

  describe('createSale (ACID & orquestación con inventario)', () => {
    it('crea una venta con éxito, recalcula totales y descuenta stock atómicamente', async () => {
      const invRepo = new InventoryMockRepository('tnt-andina-001')
      const initialStock = await invRepo.getAvailability('prd-andina-001') // Cemento Portland (stock 18)
      expect(initialStock).toBe(18)

      const sale = await repo.createSale({
        customerName: 'Cliente Prueba S.A.',
        customerIdentification: '1799999999001',
        paymentMethod: 'Transferencia bancaria',
        lines: [
          {
            productId: 'prd-andina-001',
            quantity: 5,
          },
        ],
        discountCents: 100, // 1 USD de descuento
        notes: 'Entrega en obra norte',
      })

      // 1. Verificaciones del comprobante creado
      expect(sale.receiptNumber).toBe('001-001-000000109')
      expect(sale.customerName).toBe('Cliente Prueba S.A.')
      expect(sale.status).toBe('paid')
      expect(sale.notes).toBe('Entrega en obra norte')

      // 2. Recálculo server-side: Cemento unitPrice = 850 centavos ($8.50)
      // subtotal = 5 * 850 = 4250
      // gravado con descuento = 4250 - 100 = 4150
      // iva 15% = round(4150 * 0.15) = 623
      // total = 4150 + 623 = 4773
      expect(sale.lines[0].subtotalCents).toBe(4250)
      expect(sale.subtotalGravadoCents).toBe(4250)
      expect(sale.discountCents).toBe(100)
      expect(sale.ivaCents).toBe(623)
      expect(sale.totalCents).toBe(4773)

      // 3. Stock descontado en inventario
      const updatedStock = await invRepo.getAvailability('prd-andina-001')
      expect(updatedStock).toBe(13) // 18 - 5 = 13

      // 4. Venta presente en listado
      const list = await repo.list({}, 0)
      expect(list.items[0].id).toBe(sale.id)
    })

    it('asigna estado pending cuando la forma de pago es Crédito 30 días', async () => {
      const sale = await repo.createSale({
        customerName: 'Empresa Constructora',
        customerIdentification: '1790001112001',
        paymentMethod: 'Crédito 30 días',
        lines: [{ productId: 'prd-andina-001', quantity: 1 }],
      })

      expect(sale.status).toBe('pending')
      expect(sale.paymentMethod).toBe('Crédito 30 días')
    })

    it('rechaza con insufficient_availability y preserva el stock intacto cuando no hay suficiente stock', async () => {
      const invRepo = new InventoryMockRepository('tnt-andina-001')
      const initialStock = await invRepo.getAvailability('prd-andina-004') // Disco de corte (stock 6)
      expect(initialStock).toBe(6)

      let caughtError: PosApiError | null = null
      try {
        await repo.createSale({
          customerName: 'Cliente Grande',
          customerIdentification: '1791234567001',
          paymentMethod: 'Efectivo',
          lines: [{ productId: 'prd-andina-004', quantity: 10 }], // Solicita 10 pero solo hay 6
        })
      } catch (err) {
        caughtError = err as PosApiError
      }

      expect(caughtError).not.toBeNull()
      expect(caughtError?.kind).toBe('insufficient_availability')
      expect(caughtError?.message).toContain('Stock insuficiente')

      // Stock permanece exactamente igual (ACID - rollback simulado)
      const afterStock = await invRepo.getAvailability('prd-andina-004')
      expect(afterStock).toBe(6)

      // No se agregó ninguna venta
      const list = await repo.list({}, 0)
      expect(list.items[0].receiptNumber).toBe('001-001-000000101')
    })

    it('valida campos obligatorios de cliente y líneas', async () => {
      // Falta cliente
      await expect(
        repo.createSale({
          customerName: '',
          customerIdentification: '1790000000001',
          paymentMethod: 'Efectivo',
          lines: [{ productId: 'prd-andina-001', quantity: 1 }],
        })
      ).rejects.toMatchObject({ kind: 'validation' })

      // Sin líneas
      await expect(
        repo.createSale({
          customerName: 'Cliente',
          customerIdentification: '1790000000001',
          paymentMethod: 'Efectivo',
          lines: [],
        })
      ).rejects.toMatchObject({ kind: 'validation' })

      // Cantidad negativa o no entera
      await expect(
        repo.createSale({
          customerName: 'Cliente',
          customerIdentification: '1790000000001',
          paymentMethod: 'Efectivo',
          lines: [{ productId: 'prd-andina-001', quantity: -2 }],
        })
      ).rejects.toMatchObject({ kind: 'validation' })
    })

    it('incrementa secuencialmente el número de comprobante en ventas sucesivas', async () => {
      const sale1 = await repo.createSale({
        customerName: 'Cliente 1',
        customerIdentification: '1711111111',
        paymentMethod: 'Efectivo',
        lines: [{ productId: 'prd-andina-001', quantity: 1 }],
      })
      expect(sale1.receiptNumber).toBe('001-001-000000109')

      const sale2 = await repo.createSale({
        customerName: 'Cliente 2',
        customerIdentification: '1722222222',
        paymentMethod: 'Efectivo',
        lines: [{ productId: 'prd-andina-001', quantity: 1 }],
      })
      expect(sale2.receiptNumber).toBe('001-001-000000110')
    })
  })
})
