import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from './Card'

describe('Card', () => {
  // --- Renderizado básico ---

  it('renderiza el contenido de sus hijos', () => {
    render(<Card>Contenido de la tarjeta</Card>)
    expect(screen.getByText('Contenido de la tarjeta')).toBeInTheDocument()
  })

  it('no muestra el header cuando no se pasan title ni actions', () => {
    const { container } = render(<Card>Solo cuerpo</Card>)
    expect(container.querySelector('.card__header')).not.toBeInTheDocument()
  })

  // --- Título ---

  it('muestra el header y el título cuando se pasa title', () => {
    render(<Card title="Resumen">Contenido</Card>)
    expect(screen.getByText('Resumen')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Resumen', level: 3 })).toBeInTheDocument()
  })

  // --- Acciones ---

  it('muestra acciones cuando se pasan', () => {
    render(<Card actions={<button>Acción</button>}>Contenido</Card>)
    expect(screen.getByRole('button', { name: 'Acción' })).toBeInTheDocument()
  })

  it('muestra header cuando solo se pasan acciones sin título', () => {
    const { container } = render(<Card actions={<button>Acción</button>}>Contenido</Card>)
    expect(container.querySelector('.card__header')).toBeInTheDocument()
  })

  // --- Clases adicionales ---

  it('aplica className adicional al elemento raíz', () => {
    const { container } = render(<Card className="mi-card">Contenido</Card>)
    expect(container.firstChild).toHaveClass('card', 'mi-card')
  })

  // --- Semántica ---

  it('renderiza como elemento section', () => {
    const { container } = render(<Card>Contenido</Card>)
    expect(container.firstChild?.nodeName).toBe('SECTION')
  })
})
