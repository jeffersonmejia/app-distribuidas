import { describe, it, expect } from 'vitest'
import { formatMoney, deriveProductStatus } from './formatters'

describe('inventory formatters', () => {
  it('formatea centavos a USD con 2 decimales', () => {
    const formatted = formatMoney(850)
    // es-EC produce formato con símbolo de dólar y decimales
    expect(formatted).toContain('8,50')
    expect(formatted).toContain('$')
  })

  it('formatea correctamente valores en cero o grandes', () => {
    const zero = formatMoney(0)
    expect(zero).toContain('0,00')

    const large = formatMoney(8432000)
    expect(large).toContain('84.320,00')
  })

  it('deriva correctamente el estado de stock', () => {
    expect(deriveProductStatus(10, 10)).toBe('low')
    expect(deriveProductStatus(5, 10)).toBe('low')
    expect(deriveProductStatus(11, 10)).toBe('available')
    expect(deriveProductStatus(0, 0)).toBe('low')
  })
})
