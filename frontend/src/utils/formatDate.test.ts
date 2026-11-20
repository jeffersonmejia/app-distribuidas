import { describe, it, expect } from 'vitest'
import { formatCalendarDate } from './formatDate'

describe('formatCalendarDate', () => {
  it('formatea una fecha de calendario a formato legible en español sin hora', () => {
    const formatted = formatCalendarDate('2026-11-18')
    expect(formatted).toBe('18 de noviembre de 2026')
  })

  it('no muestra hora ni sufijos a. m. / p. m. que antes se mostraban (ej. 05:30 a. m.)', () => {
    // Caso con hora ISO que anteriormente mostraba '18 de febrero de 2026, 05:30 a. m.'
    const formatted = formatCalendarDate('2026-02-18T10:30:00Z')
    expect(formatted).toBe('18 de febrero de 2026')
    expect(formatted).not.toMatch(/05:30/)
    expect(formatted).not.toMatch(/a\.\s*m\./i)
    expect(formatted).not.toMatch(/p\.\s*m\./i)
    expect(formatted).not.toMatch(/:/)
  })

  it('evita el desfase de zona horaria tratando YYYY-MM-DD como fecha local', () => {
    // Si se parseara como instante UTC a medianoche, en UTC-5 retrocedería al 17 de noviembre
    const formattedMidnight = formatCalendarDate('2026-11-18T00:00:00.000Z')
    expect(formattedMidnight).toBe('18 de noviembre de 2026')
    expect(formattedMidnight).not.toContain('17')
  })

  it('retorna cadena vacía para entradas vacías', () => {
    expect(formatCalendarDate('')).toBe('')
  })
})
