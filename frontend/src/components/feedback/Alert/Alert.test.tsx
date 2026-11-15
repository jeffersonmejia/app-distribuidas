import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Alert } from './Alert'

describe('Alert', () => {
  // --- Renderizado básico ---

  it('muestra el contenido de children', () => {
    render(<Alert>Operación completada.</Alert>)
    expect(screen.getByText('Operación completada.')).toBeInTheDocument()
  })

  // --- Variantes y clases ---

  it('usa la variante info por defecto', () => {
    const { container } = render(<Alert>Mensaje.</Alert>)
    expect(container.firstChild).toHaveClass('alert--info')
  })

  it.each(['info', 'success', 'warning', 'error'] as const)(
    'aplica la clase alert--%s con variante %s',
    (variant) => {
      const { container } = render(<Alert variant={variant}>Mensaje.</Alert>)
      expect(container.firstChild).toHaveClass(`alert--${variant}`)
    }
  )

  // --- Roles ARIA ---

  it('usa role="status" para variante info', () => {
    render(<Alert variant="info">Info</Alert>)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('usa role="status" para variante success', () => {
    render(<Alert variant="success">Éxito</Alert>)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('usa role="alert" para variante warning', () => {
    render(<Alert variant="warning">Advertencia</Alert>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('usa role="alert" para variante error', () => {
    render(<Alert variant="error">Error</Alert>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  // --- Título opcional ---

  it('muestra el título cuando se pasa', () => {
    render(<Alert title="Sin conexión">Revisa tu red.</Alert>)
    expect(screen.getByText('Sin conexión')).toBeInTheDocument()
  })

  it('no muestra el slot de título cuando no se pasa', () => {
    const { container } = render(<Alert>Solo cuerpo.</Alert>)
    expect(container.querySelector('.alert__title')).not.toBeInTheDocument()
  })

  // --- Título y cuerpo coexisten ---

  it('muestra título y cuerpo juntos', () => {
    render(<Alert title="Atención" variant="warning">Guarda tu trabajo antes de continuar.</Alert>)
    expect(screen.getByText('Atención')).toBeInTheDocument()
    expect(screen.getByText('Guarda tu trabajo antes de continuar.')).toBeInTheDocument()
  })
})
