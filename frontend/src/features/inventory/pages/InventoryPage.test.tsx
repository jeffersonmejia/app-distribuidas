import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { InventoryPage } from './InventoryPage'
import {
  InventoryMockRepository,
  resetInventoryMockStore,
  type InventoryRepository,
} from '../services'
import { renderWithProviders, cleanupSessionTestState } from '../../../test/renderWithProviders'

describe('InventoryPage', () => {
  let mockRepo: InventoryMockRepository

  beforeEach(() => {
    cleanupSessionTestState()
    resetInventoryMockStore()
    mockRepo = new InventoryMockRepository()
  })

  afterEach(() => {
    cleanupSessionTestState()
  })

  it('renderiza encabezado, métricas KPI y tabla con productos cargados', async () => {
    renderWithProviders(<InventoryPage repository={mockRepo} />, { initialPath: '/inventory' })

    // Encabezado
    expect(screen.getByRole('heading', { level: 1, name: 'Inventario' })).toBeInTheDocument()

    // Métricas KPI
    await waitFor(() => {
      expect(screen.getByText('Total de productos')).toBeInTheDocument()
      expect(screen.getByText('Stock bajo')).toBeInTheDocument()
      expect(screen.getByText('Valor del inventario')).toBeInTheDocument()
    })

    // Tabla de productos y pie de paginación
    await waitFor(() => {
      expect(screen.getByText('Cemento Portland Tipo I (50kg)')).toBeInTheDocument()
      expect(screen.getByText('SKU: MAT-2026-081')).toBeInTheDocument()
      expect(screen.getByText(/mostrando/i)).toHaveTextContent(/productos/i)
    })
  })

  it('permite filtrar por categoría al hacer clic en las pestañas', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InventoryPage repository={mockRepo} />, { initialPath: '/inventory' })

    await waitFor(() => {
      expect(screen.getByText('Cemento Portland Tipo I (50kg)')).toBeInTheDocument()
    })

    // Filtrar por Equipos
    const tabEquipos = screen.getByRole('tab', { name: /^equipos/i })
    await user.click(tabEquipos)

    await waitFor(() => {
      expect(screen.getByText('Taladro Percutor Industrial 850W')).toBeInTheDocument()
      expect(screen.queryByText('Cemento Portland Tipo I (50kg)')).not.toBeInTheDocument()
    })
  })

  it('permite buscar productos mediante el buscador con debounce', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InventoryPage repository={mockRepo} />, { initialPath: '/inventory' })

    await waitFor(() => {
      expect(screen.getByText('Cemento Portland Tipo I (50kg)')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/buscar por nombre, sku o categoría/i)
    await user.type(searchInput, 'Varilla')

    await waitFor(() => {
      expect(screen.getByText('Varilla de Acero Corrugado 12mm')).toBeInTheDocument()
      expect(screen.queryByText('Cemento Portland Tipo I (50kg)')).not.toBeInTheDocument()
    })
  })

  it('abre el drawer al presionar "+ Nuevo producto" y registra uno nuevo', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InventoryPage repository={mockRepo} />, { initialPath: '/inventory' })

    await waitFor(() => {
      expect(screen.getByText('Cemento Portland Tipo I (50kg)')).toBeInTheDocument()
    })

    // Botón en el banner
    const newBtn = screen.getByRole('button', { name: /\+ nuevo producto/i })
    await user.click(newBtn)

    // Drawer visible
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nuevo producto' })).toBeInTheDocument()

    // Llenar campos requeridos
    await user.type(screen.getByLabelText(/nombre del producto/i), 'Tornillo Autorroscante')
    await user.type(screen.getByLabelText(/código \/ sku/i), 'TOR-2026-001')

    await user.click(screen.getByRole('button', { name: /guardar producto/i }))

    // El drawer se cierra y aparece el aviso de éxito
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent(/registrado con éxito/i)
    })
  })

  it('muestra estado vacío si la búsqueda no arroja resultados', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InventoryPage repository={mockRepo} />, { initialPath: '/inventory' })

    await waitFor(() => {
      expect(screen.getByText('Cemento Portland Tipo I (50kg)')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/buscar por nombre, sku o categoría/i)
    await user.type(searchInput, 'termino-inexistente-xyz')

    await waitFor(() => {
      expect(screen.getByText('Sin productos en catálogo')).toBeInTheDocument()
    })
  })

  it('muestra mensaje de alerta y botón de reintentar si el repositorio falla', async () => {
    const failingRepo: InventoryRepository = {
      list: vi.fn().mockRejectedValue(new Error('Fallo de conexión en inventario')),
      create: vi.fn(),
    }

    renderWithProviders(<InventoryPage repository={failingRepo} />, { initialPath: '/inventory' })

    await waitFor(() => {
      expect(screen.getByText(/error al cargar inventario/i)).toBeInTheDocument()
      expect(screen.getByText(/fallo de conexión en inventario/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument()
    })
  })

  it('respeta el aislamiento de tenant', async () => {
    const repoPacifico = new InventoryMockRepository('tnt-pacifico-002')
    renderWithProviders(<InventoryPage repository={repoPacifico} />, { initialPath: '/inventory' })

    await waitFor(() => {
      expect(screen.getByText('Pintura Epóxica de Alto Tráfico (Galón)')).toBeInTheDocument()
      expect(screen.queryByText('Cemento Portland Tipo I (50kg)')).not.toBeInTheDocument()
    })
  })
})
