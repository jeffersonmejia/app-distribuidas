import { describe, it, expect } from 'vitest'
import {
  calcLineSubtotal,
  roundHalfUp,
  calcIva,
  applyDiscount,
  calcSaleTotals,
} from './calculations'
import type { SaleLine } from '../types/sale'

describe('calcLineSubtotal', () => {
  it('calcula correctamente el subtotal de línea', () => {
    expect(calcLineSubtotal(3, 850)).toBe(2550)
    expect(calcLineSubtotal(1, 1420)).toBe(1420)
  })

  it('devuelve 0 si la cantidad o el precio es 0 o negativo', () => {
    expect(calcLineSubtotal(0, 850)).toBe(0)
    expect(calcLineSubtotal(5, 0)).toBe(0)
    expect(calcLineSubtotal(-2, 500)).toBe(0)
    expect(calcLineSubtotal(2, -500)).toBe(0)
  })
})

describe('roundHalfUp', () => {
  it('redondea valores con criterio estándar HALF_UP', () => {
    expect(roundHalfUp(15.4)).toBe(15)
    expect(roundHalfUp(15.5)).toBe(16)
    expect(roundHalfUp(15.6)).toBe(16)
  })
})

describe('calcIva', () => {
  it('calcula 15% con redondeo HALF_UP en centavos', () => {
    // 100 * 0.15 = 15
    expect(calcIva(100)).toBe(15)
    // 3 * 0.15 = 0.45 -> 0
    expect(calcIva(3)).toBe(0)
    // 4 * 0.15 = 0.60 -> 1
    expect(calcIva(4)).toBe(1)
    // 10 * 0.15 = 1.5 -> 2
    expect(calcIva(10)).toBe(2)
    // 7 * 0.15 = 1.05 -> 1
    expect(calcIva(7)).toBe(1)
  })

  it('devuelve 0 para bases negativas o cero', () => {
    expect(calcIva(0)).toBe(0)
    expect(calcIva(-500)).toBe(0)
  })
})

describe('applyDiscount', () => {
  it('resta el descuento del subtotal', () => {
    expect(applyDiscount(1000, 200)).toBe(800)
    expect(applyDiscount(500, 0)).toBe(500)
  })

  it('no permite totales negativos si el descuento supera el subtotal', () => {
    expect(applyDiscount(1000, 1500)).toBe(0)
  })

  it('ignora descuentos negativos', () => {
    expect(applyDiscount(1000, -200)).toBe(1000)
  })

  it('devuelve 0 si el subtotal es 0 o negativo', () => {
    expect(applyDiscount(0, 100)).toBe(0)
    expect(applyDiscount(-100, 50)).toBe(0)
  })
})

describe('calcSaleTotals', () => {
  const sampleLines: SaleLine[] = [
    {
      productId: 'p1',
      name: 'Cemento Portland',
      sku: 'MAT-001',
      quantity: 2,
      unitPriceCents: 1000,
      subtotalCents: 2000,
    },
    {
      productId: 'p2',
      name: 'Arena Fina',
      sku: 'MAT-002',
      quantity: 1,
      unitPriceCents: 3000,
      subtotalCents: 3000,
    },
  ]

  it('calcula totales cuando todas las líneas son gravadas (por defecto)', () => {
    const totals = calcSaleTotals(sampleLines, 0)
    expect(totals.subtotal0Cents).toBe(0)
    expect(totals.subtotalGravadoCents).toBe(5000)
    expect(totals.discountCents).toBe(0)
    // 5000 * 0.15 = 750
    expect(totals.ivaCents).toBe(750)
    expect(totals.totalCents).toBe(5750)
  })

  it('aplica descuento comercial sobre la base gravada', () => {
    const totals = calcSaleTotals(sampleLines, 1000)
    expect(totals.subtotalGravadoCents).toBe(5000)
    expect(totals.discountCents).toBe(1000)
    // Base con descuento = 4000. IVA = 4000 * 0.15 = 600
    expect(totals.ivaCents).toBe(600)
    expect(totals.totalCents).toBe(4600) // 0 + 4000 + 600
  })

  it('distingue líneas no gravadas (subtotal 0%) usando gravadoLineIds', () => {
    const gravadas = new Set(['p1']) // solo p1 grava IVA
    const totals = calcSaleTotals(sampleLines, 0, gravadas)
    expect(totals.subtotal0Cents).toBe(3000) // p2 es 0%
    expect(totals.subtotalGravadoCents).toBe(2000) // p1 grava
    // IVA = 2000 * 0.15 = 300
    expect(totals.ivaCents).toBe(300)
    expect(totals.totalCents).toBe(5300) // 3000 + 2000 + 300
  })

  it('soporta lista vacía de líneas', () => {
    const totals = calcSaleTotals([], 0)
    expect(totals.subtotal0Cents).toBe(0)
    expect(totals.subtotalGravadoCents).toBe(0)
    expect(totals.discountCents).toBe(0)
    expect(totals.ivaCents).toBe(0)
    expect(totals.totalCents).toBe(0)
  })

  it('maneja descuentos mayores al subtotal gravado sin arrojar valores negativos', () => {
    const totals = calcSaleTotals(sampleLines, 10000)
    expect(totals.subtotalGravadoCents).toBe(5000)
    expect(totals.discountCents).toBe(10000)
    expect(totals.ivaCents).toBe(0)
    expect(totals.totalCents).toBe(0)
  })
})
