import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CustomerActionsMenu } from './CustomerActionsMenu'
import type { CustomerView } from '../types/customer'

const mockCustomer: CustomerView = {
  id: 'cust-1',
  fullName: 'Carlos Andrade',
  cedula: '1712345678',
  email: 'carlos@ficcion.test',
  phone: '0991234567',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('CustomerActionsMenu', () => {
  it('el botón tiene aria-haspopup="menu" y aria-expanded="false" por defecto', () => {
    render(<CustomerActionsMenu customer={mockCustomer} onToggleStatus={vi.fn()} />)
    const btn = screen.getByRole('button', { name: `Acciones de ${mockCustomer.fullName}` })
    expect(btn).toHaveAttribute('aria-haspopup', 'menu')
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('abre el menú al hacer clic en el botón de tres puntos', async () => {
    const user = userEvent.setup()
    render(<CustomerActionsMenu customer={mockCustomer} onToggleStatus={vi.fn()} />)
    const btn = screen.getByRole('button', { name: `Acciones de ${mockCustomer.fullName}` })

    await user.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('menu')
    expect(menu).toBeInTheDocument()
    expect(screen.getByText('Acciones rápidas')).toBeInTheDocument()
  })

  it('cierra el menú al presionar Escape y devuelve el foco al botón', async () => {
    const user = userEvent.setup()
    render(<CustomerActionsMenu customer={mockCustomer} onToggleStatus={vi.fn()} />)
    const btn = screen.getByRole('button', { name: `Acciones de ${mockCustomer.fullName}` })

    await user.click(btn)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(btn)
  })

  it('llama a onToggleStatus al hacer clic en Desactivar cuando está activo', async () => {
    const user = userEvent.setup()
    const handleToggle = vi.fn()
    render(<CustomerActionsMenu customer={mockCustomer} onToggleStatus={handleToggle} />)

    await user.click(screen.getByRole('button', { name: `Acciones de ${mockCustomer.fullName}` }))
    const item = screen.getByRole('menuitem', { name: /desactivar/i })
    await user.click(item)

    expect(handleToggle).toHaveBeenCalledWith(mockCustomer)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('muestra "Activar" cuando el cliente está INACTIVE', async () => {
    const user = userEvent.setup()
    const inactiveCustomer = { ...mockCustomer, status: 'INACTIVE' as const }
    const handleToggle = vi.fn()
    render(<CustomerActionsMenu customer={inactiveCustomer} onToggleStatus={handleToggle} />)

    await user.click(screen.getByRole('button', { name: `Acciones de ${inactiveCustomer.fullName}` }))
    const item = screen.getByRole('menuitem', { name: /activar/i })
    await user.click(item)

    expect(handleToggle).toHaveBeenCalledWith(inactiveCustomer)
  })

  it('navega con flechas arriba y abajo entre los ítems del menú', async () => {
    const user = userEvent.setup()
    const handleDetail = vi.fn()
    render(
      <CustomerActionsMenu
        customer={mockCustomer}
        onToggleStatus={vi.fn()}
        onViewDetail={handleDetail}
      />,
    )
    await user.click(screen.getByRole('button', { name: `Acciones de ${mockCustomer.fullName}` }))

    const detailItem = screen.getByRole('menuitem', { name: /ver detalle/i })
    const toggleItem = screen.getByRole('menuitem', { name: /desactivar/i })

    // Foco inicial en el primer elemento habilitado
    await waitFor(() => expect(document.activeElement).toBe(detailItem))

    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(toggleItem)

    await user.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(detailItem)
  })
})
