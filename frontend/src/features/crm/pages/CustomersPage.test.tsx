import { render, screen, waitFor, within, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
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
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
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
    expect(list).toHaveBeenCalledTimes(1)

    // Activa timers falsos solo para controlar el debounce de 300 ms
    vi.useFakeTimers()

    const searchInput = screen.getByPlaceholderText(/buscar/i)
    fireEvent.change(searchInput, { target: { value: 'ana' } })

    // Antes de 300 ms no se debe llamar a list con el nuevo término
    await act(async () => {
      await vi.advanceTimersByTimeAsync(299)
    })
    expect(list).toHaveBeenCalledTimes(1)

    // Tras 300 ms se debe llamar a list con search: 'ana' y página 0
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(list).toHaveBeenCalledTimes(2)
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'ana' }),
      0,
    )
  })

  it('el filtro de pestañas de estado llama a list con el status seleccionado', async () => {
    const list = vi.fn().mockResolvedValue(makePage([]))
    const repo = makeRepo({ list })
    render(<CustomersPage repository={repo} />)
    await waitFor(() => expect(list).toHaveBeenCalledOnce())

    // En lugar de select nativo, ahora se usan las pestañas de estado tipo píldora
    await userEvent.click(screen.getByRole('tab', { name: /activos/i }))
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

    // Abre drawer desde el botón del encabezado
    await userEvent.click(screen.getAllByRole('button', { name: /nuevo cliente/i })[0])
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

    await userEvent.click(screen.getAllByRole('button', { name: /nuevo cliente/i })[0])
    await userEvent.type(screen.getByLabelText(/nombre completo/i), 'Dup')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    expect(await screen.findByText(/cédula o correo/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveClass('drawer-panel--open')
  })

  it('activar cliente llama a setStatus con ACTIVE tras confirmar en el diálogo', async () => {
    const inactive = makeView({ status: 'INACTIVE' }, 1)
    const list = vi.fn().mockResolvedValue(makePage([inactive]))
    const setStatus = vi.fn().mockResolvedValue({ ...inactive, status: 'ACTIVE' })
    const repo = makeRepo({ list, setStatus })

    render(<CustomersPage repository={repo} />)
    await screen.findByText('Cliente de Ejemplo 01')

    await userEvent.click(screen.getByRole('button', { name: /activar cliente de ejemplo 01/i }))
    
    // Se abre el alertdialog de confirmación accesible
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveTextContent(/deseas activar a "Cliente de Ejemplo 01"/i)

    // Verifica que el Drawer de alta NO está abierto (no tiene clase abierta) y body tiene overflow hidden
    expect(document.querySelector('.drawer-panel')).not.toHaveClass('drawer-panel--open')
    expect(document.body.style.overflow).toBe('hidden')

    // Confirmar en el diálogo
    await userEvent.click(within(dialog).getByRole('button', { name: 'Activar' }))
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith(inactive.id, 'ACTIVE'))
    expect(document.body.style.overflow).toBe('')
  })

  it('desactivar cliente llama a setStatus con INACTIVE tras confirmar en el diálogo', async () => {
    const active = makeView({ status: 'ACTIVE' }, 2)
    const list = vi.fn().mockResolvedValue(makePage([active]))
    const setStatus = vi.fn().mockResolvedValue({ ...active, status: 'INACTIVE' })
    const repo = makeRepo({ list, setStatus })

    render(<CustomersPage repository={repo} />)
    await screen.findByText('Cliente de Ejemplo 02')

    await userEvent.click(screen.getByRole('button', { name: /desactivar cliente de ejemplo 02/i }))
    
    // Se abre el alertdialog de confirmación accesible
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveTextContent(/deseas desactivar a "Cliente de Ejemplo 02"/i)

    // Verifica que el Drawer de alta NO está abierto
    expect(document.querySelector('.drawer-panel')).not.toHaveClass('drawer-panel--open')
    expect(document.body.style.overflow).toBe('hidden')

    // Confirmar en el diálogo
    await userEvent.click(within(dialog).getByRole('button', { name: 'Desactivar' }))
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith(active.id, 'INACTIVE'))
    expect(document.body.style.overflow).toBe('')
  })

  it('no llama a setStatus si el usuario cancela en el diálogo de confirmación', async () => {
    const active = makeView({ status: 'ACTIVE' }, 3)
    const list = vi.fn().mockResolvedValue(makePage([active]))
    const setStatus = vi.fn()
    const repo = makeRepo({ list, setStatus })

    render(<CustomersPage repository={repo} />)
    await screen.findByText('Cliente de Ejemplo 03')

    await userEvent.click(screen.getByRole('button', { name: /desactivar/i }))
    
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')

    // Clic en Cancelar
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(setStatus).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
  })

  it('cierra el diálogo de confirmación y no llama a setStatus con tecla Escape', async () => {
    const active = makeView({ status: 'ACTIVE' }, 3)
    const list = vi.fn().mockResolvedValue(makePage([active]))
    const setStatus = vi.fn()
    const repo = makeRepo({ list, setStatus })

    render(<CustomersPage repository={repo} />)
    await screen.findByText('Cliente de Ejemplo 03')

    await userEvent.click(screen.getByRole('button', { name: /desactivar/i }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')

    await userEvent.keyboard('{Escape}')
    expect(setStatus).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
  })

  it('muestra mensaje de error de acción si setStatus falla tras confirmar', async () => {
    const active = makeView({ status: 'ACTIVE' }, 4)
    const list = vi.fn().mockResolvedValue(makePage([active]))
    const setStatus = vi.fn().mockRejectedValue(new CustomerApiError('err', 'unknown'))
    const repo = makeRepo({ list, setStatus })

    render(<CustomersPage repository={repo} />)
    await screen.findByText('Cliente de Ejemplo 04')
    await userEvent.click(screen.getByRole('button', { name: /desactivar/i }))

    const dialog = screen.getByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Desactivar' }))

    expect(await screen.findByText(/no se pudo cambiar el estado/i)).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
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

  it('muestra las tarjetas de métricas cuando el repositorio implementa getMetrics', async () => {
    const repo = makeRepo({
      list: vi.fn().mockResolvedValue(makePage([])),
      getMetrics: vi.fn().mockResolvedValue({
        totalClientes: 42,
        activos: 35,
        inactivos: 7,
        nuevosEsteMes: 3,
      }),
    })
    render(<CustomersPage repository={repo} />)
    expect(await screen.findByText('42')).toBeInTheDocument()
    expect(screen.getByText('35')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('no muestra las tarjetas de métricas cuando repo no tiene getMetrics', async () => {
    const repo = makeRepo({ list: vi.fn().mockResolvedValue(makePage([])) })
    render(<CustomersPage repository={repo} />)
    await screen.findByText(/sin clientes/i)
    expect(screen.queryByRole('region', { name: /resumen de cartera/i })).toBeNull()
  })

  it('renderiza iniciales y detalles en la fila del cliente', async () => {
    const item = makeView({ fullName: 'Diana Gómez', cedula: '1723456789', email: 'diana@ficcion.test' })
    const repo = makeRepo({ list: vi.fn().mockResolvedValue(makePage([item])) })
    render(<CustomersPage repository={repo} />)

    expect(await screen.findByText('DG')).toBeInTheDocument()
    expect(screen.getByText('Diana Gómez')).toBeInTheDocument()
    expect(screen.getByText('1723456789')).toBeInTheDocument()
    expect(screen.getByText('Cédula')).toBeInTheDocument()
    expect(screen.getByText('diana@ficcion.test')).toBeInTheDocument()
  })
})
