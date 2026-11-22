import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PageHeader } from './PageHeader'

describe('PageHeader Component', () => {
  it('renderiza el título obligatorio como h1', () => {
    render(<PageHeader title="Panel general" />)
    const heading = screen.getByRole('heading', { level: 1, name: 'Panel general' })
    expect(heading).toBeInTheDocument()
    expect(heading).toHaveClass('page-header__title')
  })

  it('renderiza la descripción cuando se proporciona', () => {
    render(
      <PageHeader
        title="Clientes"
        description="Cartera comercial activa y seguimiento de cuentas"
      />
    )
    expect(
      screen.getByText('Cartera comercial activa y seguimiento de cuentas')
    ).toBeInTheDocument()
  })

  it('no muestra descripción si no se proporciona', () => {
    const { container } = render(<PageHeader title="Inventario" />)
    expect(container.querySelector('.page-header__description')).not.toBeInTheDocument()
  })

  it('renderiza el badge superior cuando se proporciona', () => {
    render(<PageHeader title="Ventas" badgeText="Módulo Activo" />)
    expect(screen.getByText('Módulo Activo')).toBeInTheDocument()
  })

  it('NO renderiza el buscador si no se pasa onSearchChange', () => {
    render(<PageHeader title="Proyectos" searchPlaceholder="Buscar..." />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('renderiza el buscador y responde a onSearchChange cuando se pasa', async () => {
    const user = userEvent.setup()
    const handleSearch = vi.fn()

    render(
      <PageHeader
        title="Clientes"
        searchPlaceholder="Buscar por nombre o RUC..."
        searchValue=""
        onSearchChange={handleSearch}
      />
    )

    const input = screen.getByRole('textbox', { name: 'Buscar por nombre o RUC...' })
    expect(input).toBeInTheDocument()

    await user.type(input, 'Andina')
    expect(handleSearch).toHaveBeenCalled()
  })

  it('renderiza las acciones cuando se proporcionan', () => {
    render(
      <PageHeader
        title="Clientes"
        actions={<button type="button">Nuevo cliente</button>}
      />
    )
    expect(screen.getByRole('button', { name: 'Nuevo cliente' })).toBeInTheDocument()
  })

  it('renderiza el footer cuando se proporciona', () => {
    render(
      <PageHeader
        title="Clientes"
        footer={<div data-testid="test-footer">Pestañas</div>}
      />
    )
    expect(screen.getByTestId('test-footer')).toBeInTheDocument()
  })
})
