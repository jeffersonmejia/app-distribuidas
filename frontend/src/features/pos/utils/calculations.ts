// SOLID: SRP — FUNCIONES PURAS PARA EL CÁLCULO DE IMPORTES DE VENTAS CON REDONDEO HALF_UP.

import type { SaleLine } from '../types/sale'

const IVA_RATE = 0.15

/** Calcula el subtotal de una línea (quantity × unitPriceCents). */
export function calcLineSubtotal(quantity: number, unitPriceCents: number): number {
  if (quantity < 0 || unitPriceCents < 0) return 0
  return Math.round(quantity * unitPriceCents)
}

/** Redondeo HALF_UP sobre centavos enteros. */
export function roundHalfUp(value: number): number {
  return Math.round(value)
}

/** Calcula el IVA 15% sobre la base gravada con redondeo HALF_UP. */
export function calcIva(gravadoCents: number): number {
  if (gravadoCents <= 0) return 0
  return roundHalfUp(gravadoCents * IVA_RATE)
}

/** Aplica descuento comercial al subtotal gravado, acotado a 0. */
export function applyDiscount(subtotalCents: number, discountCents: number): number {
  if (subtotalCents <= 0) return 0
  return Math.max(0, subtotalCents - Math.max(0, discountCents))
}

export interface SaleTotals {
  subtotal0Cents: number
  subtotalGravadoCents: number
  discountCents: number
  ivaCents: number
  totalCents: number
}

/**
 * Calcula los totales de una venta a partir de las líneas y descuento opcional.
 * Si gravadoLineIds se especifica y no está vacío, solo esas líneas gravan IVA;
 * de lo contrario, todas las líneas se consideran gravadas al 15%.
 */
export function calcSaleTotals(
  lines: SaleLine[],
  discountCents = 0,
  gravadoLineIds?: Set<string>
): SaleTotals {
  let subtotal0Cents = 0
  let subtotalGravadoCents = 0

  for (const line of lines) {
    const isGravada = !gravadoLineIds || gravadoLineIds.size === 0 || gravadoLineIds.has(line.productId)
    if (isGravada) {
      subtotalGravadoCents += line.subtotalCents
    } else {
      subtotal0Cents += line.subtotalCents
    }
  }

  const effectiveDiscount = Math.max(0, discountCents)
  const baseGravadaConDescuento = applyDiscount(subtotalGravadoCents, effectiveDiscount)
  const ivaCents = calcIva(baseGravadaConDescuento)
  const totalCents = subtotal0Cents + baseGravadaConDescuento + ivaCents

  return {
    subtotal0Cents,
    subtotalGravadoCents,
    discountCents: effectiveDiscount,
    ivaCents,
    totalCents,
  }
}
