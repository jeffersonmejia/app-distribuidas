import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { CustomerDrawer } from './CustomerDrawer'
import { CustomerApiError, type CustomerRepository } from '../services/customerRepository'
import type { CustomerInput, CustomerView } from '../types/customer'

// Doble de repositorio para pruebas
function makeRepo(overrides: Partial<CustomerRepository> = {}): CustomerRepository {
  return {
    list: vi.fn<() => Promise<{ items: CustomerView[]; page: number; size: number; hasNext: boolean }>>().mockResolvedValue({ items: [], page: 0, size: 0, hasNext: false }),
    create: vi.fn<(input: CustomerInput) => Promise<CustomerView>>().mockResolvedValue({
      id: 'test-001',
      fullName: 'Nombre Prueba',
      cedula: null,
      email: null,
      phone: null,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } satisfies CustomerView),
    update: vi.fn<(id: string, input: CustomerInput) => Promise<CustomerView>>().mockImplementation(async (_id: string, input: CustomerInput) => {
      const updated: CustomerView = {
        id: 'test-001',
        fullName: input.fullName,
        cedula: input.cedula ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }
      return updated
    }),
    archive: vi.fn<() => Promise<void>>().mockResolvedValue(),
    setStatus: vi.fn(),
    ...overrides,
  }
}

describe('CustomerDrawer', () => {
  let onClose: Mock<() => void>
  let onCreated: Mock<(customer: CustomerView) => void>

  beforeEach(() => {
    onClose = vi.fn<() => void>()
    onCreated = vi.fn<(customer: CustomerView) => void>()
  })

  it('renderiza el formulario con los 4 campos cuando isOpen es true', () => {
    render(
      <CustomerDrawer
        isOpen
        onClose={onClose}
        repository={makeRepo()}
        onCreated={onCreated}
      />,
    )
    expect(screen.getByLabelText(/nombre completo/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Cédula', { selector: 'input' })).toBeInTheDocument()
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/teléfono/i)).toBeInTheDocument()
  })

  it('no muestra el panel cuando isOpen es false', () => {
    render(
      <CustomerDrawer
        isOpen={false}
        onClose={onClose}
        repository={makeRepo()}
        onCreated={onCreated}
      />,
    )
    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveClass('drawer-panel--open')
  })

  it('muestra error de validación si se envía sin nombre', async () => {
    render(
      <CustomerDrawer
        isOpen
        onClose={onClose}
        repository={makeRepo()}
        onCreated={onCreated}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    expect(await screen.findByText(/nombre completo es obligatorio/i)).toBeInTheDocument()
  })

  it('muestra error si la cédula no tiene 10 dígitos', async () => {
    render(
      <CustomerDrawer
        isOpen
        onClose={onClose}
        repository={makeRepo()}
        onCreated={onCreated}
      />,
    )
    await userEvent.type(screen.getByLabelText(/nombre completo/i), 'Test')
    await userEvent.type(screen.getByLabelText('Cédula', { selector: 'input' }), '12345')
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    expect(await screen.findByText(/exactamente 10 dígitos/i)).toBeInTheDocument()
  })

  it('llama a repository.create y onCreated al guardar datos válidos', async () => {
    const repo = makeRepo()
    render(
      <CustomerDrawer
        isOpen
        onClose={onClose}
        repository={repo}
        onCreated={onCreated}
      />,
    )
    await userEvent.type(screen.getByLabelText(/nombre completo/i), 'Nombre Prueba')
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    await waitFor(() => expect(repo.create).toHaveBeenCalledOnce())
    expect(onCreated).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('muestra mensaje de duplicado cuando el repositorio lanza CustomerApiError kind=duplicate', async () => {
    const repo = makeRepo({
      create: vi.fn().mockRejectedValue(
        new CustomerApiError('dup', 'duplicate', 409),
      ),
    })
    render(
      <CustomerDrawer
        isOpen
        onClose={onClose}
        repository={repo}
        onCreated={onCreated}
      />,
    )
    await userEvent.type(screen.getByLabelText(/nombre completo/i), 'Test Dup')
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    expect(await screen.findByText(/cédula o correo/i)).toBeInTheDocument()
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('el botón Guardar está deshabilitado mientras envía', async () => {
    let resolveCreate!: () => void
    const repo = makeRepo({
      create: vi.fn().mockReturnValue(new Promise<CustomerView>((res) => {
        resolveCreate = () => res({
          id: 't1', fullName: 'T', cedula: null, email: null, phone: null,
          status: 'ACTIVE', createdAt: '', updatedAt: '',
        })
      })),
    })
    render(
      <CustomerDrawer
        isOpen
        onClose={onClose}
        repository={repo}
        onCreated={onCreated}
      />,
    )
    await userEvent.type(screen.getByLabelText(/nombre completo/i), 'Test')
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled()
    resolveCreate()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('en modo edición renderiza el título "Editar cliente" y pre-llena los campos', () => {
    const customer: CustomerView = {
      id: 'cust-123',
      fullName: 'Juan Pérez',
      cedula: '1700000001',
      email: 'juan@ficcion.test',
      phone: '0991234567',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
    render(
      <CustomerDrawer
        isOpen
        onClose={onClose}
        repository={makeRepo()}
        onCreated={onCreated}
        customerToEdit={customer}
      />,
    )
    expect(screen.getByRole('heading', { name: /editar cliente/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/nombre completo/i)).toHaveValue('Juan Pérez')
    expect(screen.getByLabelText('Cédula', { selector: 'input' })).toHaveValue('1700000001')
    expect(screen.getByLabelText(/correo electrónico/i)).toHaveValue('juan@ficcion.test')
    expect(screen.getByLabelText(/teléfono/i)).toHaveValue('0991234567')
  })

  it('en modo edición llama a repository.update y onUpdated al guardar', async () => {
    const customer: CustomerView = {
      id: 'cust-123',
      fullName: 'Juan Pérez',
      cedula: '1700000001',
      email: 'juan@ficcion.test',
      phone: '0991234567',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
    const onUpdated = vi.fn<(customer: CustomerView) => void>()
    const repo = makeRepo()
    render(
      <CustomerDrawer
        isOpen
        onClose={onClose}
        repository={repo}
        onCreated={onCreated}
        customerToEdit={customer}
        onUpdated={onUpdated}
      />,
    )
    const nameInput = screen.getByLabelText(/nombre completo/i)
    fireEvent.change(nameInput, { target: { value: 'Juan Carlos Pérez' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => {
      expect(repo.update).toHaveBeenCalledWith('cust-123', expect.objectContaining({
        fullName: 'Juan Carlos Pérez',
      }))
    })
    expect(onUpdated).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('en modo edición muestra error si la actualización da duplicado', async () => {
    const customer: CustomerView = {
      id: 'cust-123',
      fullName: 'Juan Pérez',
      cedula: null,
      email: null,
      phone: null,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
    const repo = makeRepo({
      update: vi.fn().mockRejectedValue(new CustomerApiError('dup', 'duplicate', 409)),
    })
    render(
      <CustomerDrawer
        isOpen
        onClose={onClose}
        repository={repo}
        onCreated={onCreated}
        customerToEdit={customer}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    expect(await screen.findByText(/cédula o correo/i)).toBeInTheDocument()
  })
})
