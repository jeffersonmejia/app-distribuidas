import { describe, it, expect } from 'vitest'
import { getCustomerInitials, getAvatarColorVariant } from './initials'

describe('getCustomerInitials', () => {
  it('combina la primera letra de la primera palabra y de la última palabra', () => {
    expect(getCustomerInitials('María Fernanda Morales')).toBe('MM')
    expect(getCustomerInitials('Diana Gómez')).toBe('DG')
    expect(getCustomerInitials('Juan Carlos Pérez')).toBe('JP')
  })

  it('ignora partículas comunes como de, del, la, los, las', () => {
    expect(getCustomerInitials('Carlos de la Torre')).toBe('CT')
    expect(getCustomerInitials('Lucía del Carmen')).toBe('LC')
    expect(getCustomerInitials('Jorge de los Ríos')).toBe('JR')
    expect(getCustomerInitials('Ana las Mercedes')).toBe('AM')
  })

  it('devuelve una sola letra para nombres de una sola palabra', () => {
    expect(getCustomerInitials('Juan')).toBe('J')
    expect(getCustomerInitials('andrea')).toBe('A')
  })

  it('devuelve CL por defecto si la cadena está vacía o solo contiene espacios', () => {
    expect(getCustomerInitials('')).toBe('CL')
    expect(getCustomerInitials('   ')).toBe('CL')
  })

  it('usa los tokens originales si todas las palabras son partículas', () => {
    expect(getCustomerInitials('de la')).toBe('DL')
  })

  it('determina una variante de color determinista entre brand, success, warning y neutral', () => {
    const variant1 = getAvatarColorVariant('Carlos Alberto Mendoza')
    const variant2 = getAvatarColorVariant('Carlos Alberto Mendoza')
    expect(variant1).toBe(variant2) // Determinista
    expect(['brand', 'success', 'warning', 'neutral']).toContain(variant1)

    const variantB = getAvatarColorVariant('Lucía del Carmen Viteri')
    expect(['brand', 'success', 'warning', 'neutral']).toContain(variantB)
  })
})
