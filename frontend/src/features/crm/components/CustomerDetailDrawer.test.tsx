import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, type Mock } from 'vitest'
import { CustomerDetailDrawer } from './CustomerDetailDrawer'
import type { CustomerView } from '../types/customer'

const MOCK_CUSTOMER: CustomerView = {
  id: 'cust-detail-1',
  fullName: 'María Fernanda Morales',
  cedula: '1712345678',
  email: 'maria@ficcion.test',
  phone: '0987654321',
  status: 'ACTIVE',
  createdAt: '2026-01-10T10:00:00Z',
  updatedAt: '2026-01-15T15:30:00Z',
}

describe('CustomerDetailDrawer', () => {
  it('renderiza la información del cliente cuando está abierto', () => {
    const onClose: Mock<() => void> = vi.fn()
    render(
      <CustomerDetailDrawer
        isOpen
        onClose={onClose}
        customer={MOCK_CUSTOMER}
      />,
    )

    expect(screen.getByRole('heading', { name: /detalle de cliente/i })).toBeInTheDocument()
    expect(screen.getByText('María Fernanda Morales')).toBeInTheDocument()
    expect(screen.getByText('1712345678')).toBeInTheDocument()
    expect(screen.getByText('maria@ficcion.test')).toBeInTheDocument()
    expect(screen.getByText('0987654321')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(screen.getByText('MM')).toBeInTheDocument() // Iniciales
  })

  it('llama a onClose al hacer clic en Cerrar', () => {
    const onClose: Mock<() => void> = vi.fn()
    render(
      <CustomerDetailDrawer
        isOpen
        onClose={onClose}
        customer={MOCK_CUSTOMER}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('llama a onEdit y onClose al hacer clic en Editar cliente', () => {
    const onClose: Mock<() => void> = vi.fn()
    const onEdit: Mock<(customer: CustomerView) => void> = vi.fn()

    render(
      <CustomerDetailDrawer
        isOpen
        onClose={onClose}
        customer={MOCK_CUSTOMER}
        onEdit={onEdit}
      />,
    )

    const editBtn = screen.getByRole('button', { name: /editar cliente/i })
    fireEvent.click(editBtn)

    expect(onEdit).toHaveBeenCalledWith(MOCK_CUSTOMER)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('muestra mensaje cuando customer es null', () => {
    const onClose: Mock<() => void> = vi.fn()
    render(
      <CustomerDetailDrawer
        isOpen
        onClose={onClose}
        customer={null}
      />,
    )

    expect(screen.getByText(/no se seleccionó ningún cliente/i)).toBeInTheDocument()
  })
})
