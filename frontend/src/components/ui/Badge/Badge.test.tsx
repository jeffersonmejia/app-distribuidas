import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from './Badge'

describe('Badge', () => {
  // --- Renderizado ---

  it('renderiza el texto de sus hijos', () => {
    render(<Badge>Activo</Badge>)
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  it('usa la variante neutral por defecto', () => {
    render(<Badge>Pendiente</Badge>)
    expect(screen.getByText('Pendiente')).toHaveClass('badge--neutral')
  })

  // --- Variantes ---

  it.each([
    ['success', 'Activo'],
    ['warning', 'Pendiente'],
    ['error', 'Error'],
    ['info', 'Información'],
    ['brand', 'Destacado'],
    ['neutral', 'Normal'],
  ] as const)('aplica la clase badge--%s con variante %s', (variant, label) => {
    render(<Badge variant={variant}>{label}</Badge>)
    expect(screen.getByText(label)).toHaveClass(`badge--${variant}`)
  })

  // --- Accesibilidad: es un span, no un rol interactivo ---

  it('renderiza como elemento span', () => {
    const { container } = render(<Badge>Test</Badge>)
    expect(container.firstChild?.nodeName).toBe('SPAN')
  })
})
