import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { CustomersPage } from './CustomersPage'
import { CustomerApiError, type CustomerRepository } from '../services/customerRepository'
import type { CustomerPage, CustomerView } from '../types/customer'

// ── Helpers ──────────────────────────────────────────────────────────────
function makeView(overrides: Partial<CustomerView> = {}, i = 1): CustomerView {
  return {
    id: `id-${i}`,
    fullName: `Cliente de Ejemplo ${String(i).padStart(2, '0')}`,
    cedula: `170000000${i}`,
    email: `ejemplo${i}@ficcion.test`,
    phone: `099100000${i}`,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makePage(items: CustomerView[], hasNext = false, page = 0): CustomerPage {
  return { items, page, size: items.length, hasNext }
}

function makeRepo(overrides: Partial<CustomerRepository> = {}): CustomerRepository {
  return {
    list: vi.fn().mockResolvedValue(makePage([])),
    create: vi.fn().mockResolvedValue(makeView({}, 99)),
    setStatus: vi.fn().mockImplementation(async (id: string, status: CustomerView['status']) => {
      return makeView({ id, status }, 1)
    }),
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────
describe('CustomersPage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('muestra spinner mientras carga', async () => {
    // list nunca resuelve durante esta prueba
    const repo = makeRepo({ list: vi.fn().mockReturnValue(new Promise(() => {})) })
    render(<CustomersPage repository={repo} />)
    expect(screen.getByRole('status', { name: /cargando/i })).toBeInTheDocument()
  })

  it('muestra 5 filas cuando el repositorio devuelve 5 clientes', async () => {
    const items = [1, 2, 3, 4, 5].map((i) => makeView({}, i))
    const repo = makeRepo({ list: vi.fn().mockResolvedValue(makePage(items, false)) })
    render(<CustomersPage repository={repo} />)
    expect(await screen.findAllByRole('row')).toHaveLength(6) // 5 datos + 1 cabecera
  })

  it('muestra EmptyState cuando no hay clientes', async () => {
    const repo = makeRepo({ list: vi.fn().mockResolvedValue(makePage([], false)) })
    render(<CustomersPage repository={repo} />)
    expect(await screen.findByText(/sin clientes/i)).toBeInTheDocument()
  })

  it('muestra alert de error cuando list lanza un error genérico', async () => {
    const repo = makeRepo({
      list: vi.fn().mockRejectedValue(new CustomerApiError('fallo', 'unknown')),
    })
    render(<CustomersPage repository={repo} />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/no se pudo cargar/i)).toBeInTheDocument()
  })

  it('muestra mensaje 403 cuando list lanza error forbidden', async () => {
    const repo = makeRepo({
      list: vi.fn().mockRejectedValue(new CustomerApiError('', 'forbidden', 403)),
    })
    render(<CustomersPage repository={repo} />)
    expect(await screen.findByText(/no tienes permiso para ver clientes/i)).toBeInTheDocument()
  })

  it('la paginación avanza a la siguiente página', async () => {
    const page0 = makePage([1, 2, 3, 4, 5].map((i) => makeView({}, i)), true, 0)
    const page1 = makePage([makeView({}, 6)], false, 1)
    const list = vi.fn()
      .mockResolvedValueOnce(page0)
      .mockResolvedValueOnce(page1)
    const repo = makeRepo({ list })
    render(<CustomersPage repository={repo} />)
    expect(await screen.findAllByRole('row')).toHaveLength(6)

    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(await screen.findByText('Cliente de Ejemplo 06')).toBeInTheDocument()
  })

  it('la búsqueda con debounce 300 ms llama a list con el término', async () => {
    const list = vi.fn().mockResolvedValue(makePage([makeView({}, 1)]))
    const repo = makeRepo({ list })
    render(<CustomersPage repository={repo} />)
    await screen.findAllByRole('row')

    const searchInput = screen.getByPlaceholderText(/buscar/i)
    await act(async () => {
      await userEvent.type(searchInput, 'Ejemplo')
    })
    // Avanzamos el debounce
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    await waitFor(() => expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'Ejemplo' }),
      0,
    ))
  })

  it('el filtro de estado llama a list con el status seleccionado', async () => {
    const list = vi.fn().mockResolvedValue(makePage([]))
    const repo = makeRepo({ list })
    render(<CustomersPage repository={repo} />)
    await waitFor(() => expect(list).toHaveBeenCalledOnce())

    await userEvent.selectOptions(screen.getByLabelText(/estado/i), 'ACTIVE')
    await waitFor(() => expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACTIVE' }),
      0,
    ))
  })

  it('abre el drawer al hacer clic en "Nuevo cliente"', async () => {
    const repo = makeRepo({ list: vi.fn().mockResolvedValue(makePage([])) })
    render(<CustomersPage repository={repo} />)
    await screen.findByText(/sin clientes/i)

    await userEvent.click(screen.getAllByRole('button', { name: /nuevo cliente/i })[0])
    expect(screen.getByRole('dialog')).toHaveClass('drawer-panel--open')
  })

  it('después de crear un cliente recarga la lista', async () => {
    const list = vi.fn()
      .mockResolvedValueOnce(makePage([]))
      .mockResolvedValueOnce(makePage([makeView({}, 99)]))
    const repo = makeRepo({
      list,
      create: vi.fn().mockResolvedValue(makeView({}, 99)),
    })
    render(<CustomersPage repository={repo} />)
    await screen.findByText(/sin clientes/i)

    // Abre drawer desde el EmptyState
    await userEvent.click(screen.getByRole('button', { name: /nuevo cliente/i }))
    // Rellena nombre y guarda
    await userEvent.type(screen.getByLabelText(/nombre completo/i), 'Cliente 99')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    expect(await screen.findByText('Cliente de Ejemplo 99')).toBeInTheDocument()
  })

  it('error de duplicado en drawer no cierra el panel', async () => {
    const repo = makeRepo({
      list: vi.fn().mockResolvedValue(makePage([])),
      create: vi.fn().mockRejectedValue(new CustomerApiError('dup', 'duplicate', 409)),
    })
    render(<CustomersPage repository={repo} />)
    await screen.findByText(/sin clientes/i)

    await userEvent.click(screen.getByRole('button', { name: /nuevo cliente/i }))
    await userEvent.type(screen.getByLabelText(/nombre completo/i), 'Dup')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    expect(await screen.findByText(/cédula o correo/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveClass('drawer-panel--open')
  })

  it('activar cliente llama a setStatus con ACTIVE', async () => {
    const inactive = makeView({ status: 'INACTIVE' }, 1)
    const list = vi.fn().mockResolvedValue(makePage([inactive]))
    const setStatus = vi.fn().mockResolvedValue({ ...inactive, status: 'ACTIVE' })
    const repo = makeRepo({ list, setStatus })

    // Reemplazamos window.confirm para aceptar
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<CustomersPage repository={repo} />)
    await screen.findByText('Cliente de Ejemplo 01')

    await userEvent.click(screen.getByRole('button', { name: /activar cliente de ejemplo 01/i }))
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith(inactive.id, 'ACTIVE'))

    vi.restoreAllMocks()
  })

  it('desactivar cliente llama a setStatus con INACTIVE', async () => {
    const active = makeView({ status: 'ACTIVE' }, 2)
    const list = vi.fn().mockResolvedValue(makePage([active]))
    const setStatus = vi.fn().mockResolvedValue({ ...active, status: 'INACTIVE' })
    const repo = makeRepo({ list, setStatus })

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<CustomersPage repository={repo} />)
    await screen.findByText('Cliente de Ejemplo 02')

    await userEvent.click(screen.getByRole('button', { name: /desactivar cliente de ejemplo 02/i }))
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith(active.id, 'INACTIVE'))

    vi.restoreAllMocks()
  })

  it('no llama a setStatus si el usuario cancela la confirmación', async () => {
    const active = makeView({ status: 'ACTIVE' }, 3)
    const list = vi.fn().mockResolvedValue(makePage([active]))
    const setStatus = vi.fn()
    const repo = makeRepo({ list, setStatus })

    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<CustomersPage repository={repo} />)
    await screen.findByText('Cliente de Ejemplo 03')

    await userEvent.click(screen.getByRole('button', { name: /desactivar/i }))
    expect(setStatus).not.toHaveBeenCalled()

    vi.restoreAllMocks()
  })

  it('muestra mensaje de error de acción si setStatus falla', async () => {
    const active = makeView({ status: 'ACTIVE' }, 4)
    const list = vi.fn().mockResolvedValue(makePage([active]))
    const setStatus = vi.fn().mockRejectedValue(new CustomerApiError('err', 'unknown'))
    const repo = makeRepo({ list, setStatus })

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<CustomersPage repository={repo} />)
    await screen.findByText('Cliente de Ejemplo 04')
    await userEvent.click(screen.getByRole('button', { name: /desactivar/i }))

    expect(await screen.findByText(/no se pudo cambiar el estado/i)).toBeInTheDocument()

    vi.restoreAllMocks()
  })

  it('la fila del cliente muestra el badge de estado correcto', async () => {
    const items = [
      makeView({ status: 'ACTIVE' }, 1),
      makeView({ status: 'INACTIVE' }, 2),
    ]
    const repo = makeRepo({ list: vi.fn().mockResolvedValue(makePage(items)) })
    render(<CustomersPage repository={repo} />)

    const rows = await screen.findAllByRole('row')
    // fila 1 (índice 1 porque índice 0 es header)
    expect(within(rows[1]).getByText('Activo')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Inactivo')).toBeInTheDocument()
  })
})
