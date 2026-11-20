/**
 * @file NewSaleIntegration.test.tsx
 * @description Prueba de integración: verifica que createSale() descuenta stock de Inventario
 * de forma atómica usando los repositorios simulados del mismo tenant.
 *
 * Cubre:
 *  - Stock reducido correctamente tras una venta exitosa.
 *  - Stock NO modificado si createSale() falla por insufficient_availability.
 *  - kind=validation cuando no hay líneas.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { PosMockRepository, resetPosMockStore } from '../../services/posMock'
import { InventoryMockRepository, resetInventoryMockStore } from '../../../inventory/services/inventoryMock'
import { PosApiError } from '../../services/posRepository'

// Tenant de prueba que coincide con los datos del mock
const TENANT = 'tnt-andina-001'
// ID y stock inicial conocido del mock (Cemento Portland): 18 unidades
const CEMENT_ID = 'prd-andina-001'
const INITIAL_CEMENT_STOCK = 18

/** Parámetros base de venta válida para reutilizar en tests */
function baseSaleInput(overrides: { quantity?: number } = {}) {
  return {
    customerName: 'Constructora Andina S.A.',
    customerIdentification: '0190156789001',
    issuedAt: '2026-11-20',
    paymentMethod: 'Efectivo' as const,
    lines: [{ productId: CEMENT_ID, quantity: overrides.quantity ?? 5, unitPriceCents: 1700 }],
    discountCents: 0,
  }
}

beforeEach(() => {
  resetInventoryMockStore()
  resetPosMockStore()
})

describe('integración: createSale descuenta stock de InventoryMockRepository', () => {
  it('reduce el stock del producto tras una venta exitosa', async () => {
    const invRepo = new InventoryMockRepository(TENANT)
    const posRepo = new PosMockRepository(TENANT, undefined, invRepo)

    const qty = 5
    await posRepo.createSale(baseSaleInput({ quantity: qty }))

    // getById verifica el stock directamente sin límite de paginación
    const updated = await invRepo.getById!(CEMENT_ID)
    expect(updated.stock).toBe(INITIAL_CEMENT_STOCK - qty)
  })

  it('NO modifica el stock si la venta falla por stock insuficiente', async () => {
    const invRepo = new InventoryMockRepository(TENANT)
    const posRepo = new PosMockRepository(TENANT, undefined, invRepo)

    await expect(
      posRepo.createSale(baseSaleInput({ quantity: INITIAL_CEMENT_STOCK + 100 }))
    ).rejects.toBeInstanceOf(PosApiError)

    const unchanged = await invRepo.getById!(CEMENT_ID)
    expect(unchanged.stock).toBe(INITIAL_CEMENT_STOCK)
  })

  it('rechaza con kind=insufficient_availability cuando el stock es insuficiente', async () => {
    const invRepo = new InventoryMockRepository(TENANT)
    const posRepo = new PosMockRepository(TENANT, undefined, invRepo)

    let caughtError: PosApiError | undefined
    try {
      await posRepo.createSale(baseSaleInput({ quantity: 999 }))
    } catch (err) {
      if (err instanceof PosApiError) caughtError = err
    }
    expect(caughtError).toBeInstanceOf(PosApiError)
    expect(caughtError?.kind).toBe('insufficient_availability')
  })

  it('rechaza con kind=validation cuando no hay líneas en la venta', async () => {
    const invRepo = new InventoryMockRepository(TENANT)
    const posRepo = new PosMockRepository(TENANT, undefined, invRepo)

    let caughtError: PosApiError | undefined
    try {
      await posRepo.createSale({
        customerName: 'Constructora Andina S.A.',
        customerIdentification: '0190156789001',
        issuedAt: '2026-11-20',
        paymentMethod: 'Efectivo',
        lines: [],
        discountCents: 0,
      })
    } catch (err) {
      if (err instanceof PosApiError) caughtError = err
    }
    expect(caughtError).toBeInstanceOf(PosApiError)
    expect(caughtError?.kind).toBe('validation')
  })
})
