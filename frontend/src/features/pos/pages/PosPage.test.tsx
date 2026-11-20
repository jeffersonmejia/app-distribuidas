import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PosPage } from './PosPage'
import { PosMockRepository, resetPosMockStore } from '../services/posMock'
import { PosApiError, type PosRepository } from '../services/posRepository'

describe('PosPage', () => {
  let mockRepo: PosRepository

  beforeEach(() => {
    resetPosMockStore()
    mockRepo = new PosMockRepository()
  })

  it('renderiza encabezado, métricas KPI y tabla con ventas cargadas', async () => {
    render(<PosPage repository={mockRepo} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Ventas' })).toBeInTheDocument()
    expect(screen.getByText(/Ventas del mes:/i)).toBeInTheDocument()

    // KPIs
    const kpiSection = screen.getByLabelText('Resumen de ventas')
    expect(within(kpiSection).getByText('Ventas del mes')).toBeInTheDocument()
    expect(within(kpiSection).getByText('Por cobrar')).toBeInTheDocument()
    expect(within(kpiSection).getByText('Vencidas')).toBeInTheDocument()

    // Esperar a que la tabla se cargue con los datos
    await waitFor(() => {
      expect(screen.getByText('001-001-000000101')).toBeInTheDocument()
    })

    expect(screen.getByText('Constructora del Valle S.A.')).toBeInTheDocument()
    expect(screen.getByText(/mostrando/i)).toHaveTextContent('Mostrando 5 ventas (Página 1)')
  })

  it('permite filtrar por estado al hacer clic en las pestañas de filtro', async () => {
    const user = userEvent.setup()
    render(<PosPage repository={mockRepo} />)

    await waitFor(() => {
      expect(screen.getByText('001-001-000000101')).toBeInTheDocument()
    })

    // Click en la pestaña 'Pendientes'
    const pendingTab = screen.getByRole('tab', { name: /^pendientes/i })
    await user.click(pendingTab)

    await waitFor(() => {
      expect(screen.getByText('001-001-000000102')).toBeInTheDocument()
      expect(screen.queryByText('001-001-000000101')).not.toBeInTheDocument()
    })
  })

  it('permite buscar comprobantes mediante el buscador con debounce', async () => {
    const user = userEvent.setup()
    render(<PosPage repository={mockRepo} />)

    await waitFor(() => {
      expect(screen.getByText('001-001-000000101')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/buscar por comprobante/i)
    await user.type(searchInput, 'Medina')

    await waitFor(
      () => {
        expect(screen.getByText('Carlos Alberto Medina Loor')).toBeInTheDocument()
        expect(screen.queryByText('Constructora del Valle S.A.')).not.toBeInTheDocument()
      },
      { timeout: 2000 }
    )
  })

  it('abre el drawer de detalle al hacer clic en "Ver detalle"', async () => {
    const user = userEvent.setup()
    render(<PosPage repository={mockRepo} />)

    await waitFor(() => {
      expect(screen.getByText('001-001-000000101')).toBeInTheDocument()
    })

    const detailButtons = screen.getAllByRole('button', { name: /ver detalle/i })
    await user.click(detailButtons[0])

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Detalle de comprobante' })).toBeInTheDocument()
      expect(screen.getByText('Datos del cliente')).toBeInTheDocument()
    })
  })

  it('muestra estado vacío si la búsqueda no arroja resultados', async () => {
    const user = userEvent.setup()
    render(<PosPage repository={mockRepo} />)

    await waitFor(() => {
      expect(screen.getByText('001-001-000000101')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/buscar por comprobante/i)
    await user.type(searchInput, 'cadena-sin-coincidencia-xyz')

    await waitFor(
      () => {
        expect(screen.getByText('No se encontraron ventas')).toBeInTheDocument()
      },
      { timeout: 2000 }
    )
  })

  it('muestra mensaje de alerta y botón de reintentar si el repositorio falla', async () => {
    const user = userEvent.setup()
    const failingRepo: PosRepository = {
      list: vi.fn().mockRejectedValue(new PosApiError('Error de conexión con el servicio', 'unknown')),
      getById: vi.fn(),
      getMetrics: vi.fn().mockRejectedValue(new Error('Métricas no disponibles')),
      createSale: vi.fn(),
    }

    render(<PosPage repository={failingRepo} />)

    await waitFor(() => {
      expect(screen.getByText('Error al cargar comprobantes')).toBeInTheDocument()
      expect(screen.getByText('Error de conexión con el servicio')).toBeInTheDocument()
    })

    const retryBtn = screen.getByRole('button', { name: /^reintentar$/i })
    expect(retryBtn).toBeInTheDocument()

    // Al reintentar vuelve a llamar a list
    await user.click(retryBtn)
    expect(failingRepo.list).toHaveBeenCalledTimes(2)
  })

  it('respeta el aislamiento de tenant', async () => {
    const repoPacifico = new PosMockRepository('tnt-pacifico-002')
    render(<PosPage repository={repoPacifico} />)

    await waitFor(() => {
      expect(screen.getByText('002-001-000000001')).toBeInTheDocument()
      expect(screen.getByText('Naviera del Pacífico S.A.')).toBeInTheDocument()
      expect(screen.queryByText('001-001-000000101')).not.toBeInTheDocument()
    })
  })
})
