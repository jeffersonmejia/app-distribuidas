import { describe, it, expect } from 'vitest'
import { escapeRegExp } from './escapeRegExp'

describe('escapeRegExp', () => {
  it('escapa todos los caracteres especiales de RegExp globalmente', () => {
    const raw = 'El precio es $8.50 (USD) + 15% [IVA] * total?'
    const escaped = escapeRegExp(raw)
    expect(new RegExp(escaped).test(raw)).toBe(true)
  })

  it('escapa múltiples signos de dólar globalmente', () => {
    const raw = '$100 y $200'
    const escaped = escapeRegExp(raw)
    expect(escaped).toBe('\\$100 y \\$200')
    expect(new RegExp(escaped).test(raw)).toBe(true)
  })

  it('no modifica cadenas sin caracteres especiales', () => {
    expect(escapeRegExp('simpleText123')).toBe('simpleText123')
  })
})
