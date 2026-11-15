import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  // --- Renderizado básico ---

  it('renderiza el texto de sus hijos', () => {
    render(<Button>Guardar</Button>)
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument()
  })

  it('aplica la variante primary por defecto', () => {
    render(<Button>Ok</Button>)
    expect(screen.getByRole('button')).toHaveClass('btn--primary')
  })

  it('aplica la variante secondary cuando se indica', () => {
    render(<Button variant="secondary">Cancelar</Button>)
    expect(screen.getByRole('button')).toHaveClass('btn--secondary')
  })

  it('aplica la variante ghost cuando se indica', () => {
    render(<Button variant="ghost">Ver</Button>)
    expect(screen.getByRole('button')).toHaveClass('btn--ghost')
  })

  it('aplica la variante danger cuando se indica', () => {
    render(<Button variant="danger">Eliminar</Button>)
    expect(screen.getByRole('button')).toHaveClass('btn--danger')
  })

  it('aplica el tamaño sm', () => {
    render(<Button size="sm">Pequeño</Button>)
    expect(screen.getByRole('button')).toHaveClass('btn--sm')
  })

  it('aplica el tamaño lg', () => {
    render(<Button size="lg">Grande</Button>)
    expect(screen.getByRole('button')).toHaveClass('btn--lg')
  })

  // --- Estado isLoading ---

  it('muestra aria-busy cuando isLoading es true', () => {
    render(<Button isLoading>Guardando</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true')
  })

  it('no muestra aria-busy cuando isLoading es false', () => {
    render(<Button>Guardar</Button>)
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy')
  })

  it('deshabilita el botón cuando isLoading es true', () => {
    render(<Button isLoading>Guardando</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  // --- Estado disabled ---

  it('deshabilita el botón cuando disabled es true', () => {
    render(<Button disabled>No disponible</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  // --- Interacción con clic ---

  it('llama a onClick al hacer clic cuando está habilitado', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Enviar</Button>)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('no llama a onClick cuando el botón está deshabilitado', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>No disponible</Button>)
    await user.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('no llama a onClick cuando el botón está cargando', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button isLoading onClick={onClick}>Cargando</Button>)
    await user.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  // --- Foco visible por teclado ---

  it('recibe foco al navegar con Tab', async () => {
    const user = userEvent.setup()
    render(<Button>Siguiente</Button>)
    await user.tab()
    expect(screen.getByRole('button')).toHaveFocus()
  })

  it('no recibe foco con Tab cuando está deshabilitado', async () => {
    const user = userEvent.setup()
    render(<Button disabled>No foco</Button>)
    await user.tab()
    expect(screen.getByRole('button')).not.toHaveFocus()
  })

  // --- Ícono ---

  it('renderiza el ícono SVG con aria-hidden cuando no está cargando', () => {
    const icon = (
      <svg data-testid="icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 5v10" />
      </svg>
    )
    render(<Button icon={icon}>Con ícono</Button>)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('no muestra el ícono cuando está cargando', () => {
    const icon = <svg data-testid="icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 5v10" /></svg>
    render(<Button icon={icon} isLoading>Cargando</Button>)
    expect(screen.queryByTestId('icon')).not.toBeInTheDocument()
  })
})
