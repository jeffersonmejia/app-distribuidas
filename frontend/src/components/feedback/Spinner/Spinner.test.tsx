import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Spinner } from './Spinner'

describe('Spinner Component', () => {
  it('renderiza con role="status" y label accesible por defecto', () => {
    render(<Spinner />)
    const status = screen.getByRole('status')
    expect(status).toBeInTheDocument()
    expect(status).toHaveAttribute('aria-label', 'Cargando...')
    expect(screen.getByText('Cargando...')).toBeInTheDocument()
  })

  it('permite personalizar el texto del label accesible', () => {
    render(<Spinner label="Obteniendo clientes..." />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Obteniendo clientes...')
    expect(screen.getByText('Obteniendo clientes...')).toBeInTheDocument()
  })

  it('aplica las clases de tamaño correspondientes', () => {
    const { container: smContainer } = render(<Spinner size="sm" />)
    expect(smContainer.firstChild).toHaveClass('spinner--sm')

    const { container: lgContainer } = render(<Spinner size="lg" />)
    expect(lgContainer.firstChild).toHaveClass('spinner--lg')
  })
})
