import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  // --- Renderizado básico ---

  it('muestra el título obligatorio', () => {
    render(<EmptyState title="Sin clientes" />)
    expect(screen.getByRole('heading', { name: 'Sin clientes', level: 3 })).toBeInTheDocument()
  })

  it('renderiza con role="status"', () => {
    render(<EmptyState title="Sin resultados" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  // --- Descripción opcional ---

  it('muestra la descripción cuando se pasa', () => {
    render(<EmptyState title="Sin clientes" description="Aún no hay clientes registrados." />)
    expect(screen.getByText('Aún no hay clientes registrados.')).toBeInTheDocument()
  })

  it('no muestra descripción cuando no se pasa', () => {
    const { container } = render(<EmptyState title="Sin clientes" />)
    expect(container.querySelector('.empty-state__description')).not.toBeInTheDocument()
  })

  // --- Acción opcional ---

  it('muestra la acción cuando se pasa', () => {
    render(
      <EmptyState
        title="Sin clientes"
        action={<button>Agregar cliente</button>}
      />
    )
    expect(screen.getByRole('button', { name: 'Agregar cliente' })).toBeInTheDocument()
  })

  it('no muestra el slot de acción cuando no se pasa', () => {
    const { container } = render(<EmptyState title="Sin clientes" />)
    expect(container.querySelector('.empty-state__action')).not.toBeInTheDocument()
  })

  // --- Ícono opcional ---

  it('muestra el ícono cuando se pasa', () => {
    const icon = (
      <svg data-testid="empty-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
      </svg>
    )
    render(<EmptyState title="Sin clientes" icon={icon} />)
    expect(screen.getByTestId('empty-icon')).toBeInTheDocument()
  })

  it('no muestra el slot de ícono cuando no se pasa', () => {
    const { container } = render(<EmptyState title="Sin clientes" />)
    expect(container.querySelector('.empty-state__icon')).not.toBeInTheDocument()
  })
})
