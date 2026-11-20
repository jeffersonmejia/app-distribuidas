import { describe, it, expect, beforeEach } from 'vitest'
import {
  InventoryMockRepository,
  resetInventoryMockStore,
} from './inventoryMock'
import { InventoryApiError } from './inventoryRepository'
import type { ProductInput } from '../types/product'

describe('InventoryMockRepository', () => {
  let repo: InventoryMockRepository

  beforeEach(() => {
    resetInventoryMockStore()
    repo = new InventoryMockRepository()
  })

  it('lista productos paginados con tamaño máximo de 5', async () => {
    const page0 = await repo.list({}, 0)
    expect(page0.size).toBe(5)
    expect(page0.items.length).toBe(5)
    expect(page0.hasNext).toBe(true)

    const page1 = await repo.list({}, 1)
    expect(page1.items.length).toBe(4) // 9 en total para andina
    expect(page1.hasNext).toBe(false)
  })

  it('filtra por término de búsqueda en nombre, sku o categoría', async () => {
    const res = await repo.list({ search: 'cemento' })
    expect(res.items.length).toBe(1)
    expect(res.items[0].name).toContain('Cemento Portland')

    const resSku = await repo.list({ search: 'EQP-2026-112' })
    expect(resSku.items.length).toBe(1)
    expect(resSku.items[0].sku).toBe('EQP-2026-112')
  })

  it('filtra por categoría específica', async () => {
    const res = await repo.list({ category: 'Materiales' })
    expect(res.items.every((p) => p.category === 'Materiales')).toBe(true)
  })

  it('valida campos obligatorios al crear producto', async () => {
    const invalidInput: ProductInput = {
      name: '',
      sku: '',
      category: 'Materiales',
      purchasePriceCents: 100,
      sellingPriceCents: -5,
      stock: -1,
      minStock: 0,
    }

    await expect(repo.create(invalidInput)).rejects.toThrow(InventoryApiError)
  })

  it('rechaza SKU duplicado', async () => {
    const input: ProductInput = {
      name: 'Otro Cemento',
      sku: 'MAT-2026-081', // Ya existe
      category: 'Materiales',
      purchasePriceCents: 500,
      sellingPriceCents: 800,
      stock: 10,
      minStock: 5,
    }

    await expect(repo.create(input)).rejects.toThrow(/ya está registrado/i)
  })

  it('crea un producto exitosamente y normaliza el SKU a mayúsculas', async () => {
    const input: ProductInput = {
      name: 'Tubo PVC 110mm',
      sku: 'tub-2026-001',
      category: 'Materiales',
      description: 'Tubo de desagüe sanitario',
      purchasePriceCents: 800,
      sellingPriceCents: 1250,
      stock: 20,
      minStock: 5,
    }

    const created = await repo.create(input)
    expect(created.sku).toBe('TUB-2026-001')
    expect(created.status).toBe('available')
    expect(created.id).toBeDefined()

    const listRes = await repo.list({ search: 'TUB-2026-001' })
    expect(listRes.items).toHaveLength(1)
  })

  it('mantiene aislamiento de datos por tenantId', async () => {
    const repoTenant1 = new InventoryMockRepository('tnt-andina-001')
    const repoTenant2 = new InventoryMockRepository('tnt-pacifico-002')

    const list1 = await repoTenant1.list()
    const list2 = await repoTenant2.list()

    expect(list1.items.length).toBe(5) // andina tiene 9 en total
    expect(list2.items.length).toBe(2) // pacifico tiene 2 en total

    expect(list2.items[0].name).toContain('Pintura Epóxica')
  })

  it('descuenta stock atómicamente con consumeStock exitoso', async () => {
    const page = await repo.list({ search: 'MAT-2026-044' }) // Varilla stock: 340
    const varilla = page.items[0]

    const result = await repo.consumeStock([{ productId: varilla.id, quantity: 40 }])
    expect(result.consumed).toBe(true)

    const updatedAvailability = await repo.getAvailability(varilla.id)
    expect(updatedAvailability).toBe(300)
  })

  it('falla con INSUFFICIENT_AVAILABILITY y NO descuenta nada si falta stock en alguna línea', async () => {
    const page = await repo.list({ search: 'MAT-2026-081' }) // Cemento stock: 18
    const cemento = page.items[0]

    await expect(
      repo.consumeStock([{ productId: cemento.id, quantity: 50 }])
    ).rejects.toThrow(/Stock insuficiente/i)

    // El stock no debe haber cambiado
    const stockAfter = await repo.getAvailability(cemento.id)
    expect(stockAfter).toBe(18)
  })

  it('calcula métricas de inventario correctamente', async () => {
    const metrics = await repo.getMetrics()
    expect(metrics.totalProducts).toBe(9)
    expect(metrics.lowStockCount).toBe(2)
    expect(metrics.totalInventoryValueCents).toBeGreaterThan(0)
  })
})
