import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewSalePage } from './NewSalePage'
import { PosMockRepository, resetPosMockStore } from '../../services/posMock'
import {
  InventoryMockRepository,
  resetInventoryMockStore,
} from '../../../inventory/services/inventoryMock'
import { CustomerMockRepository } from '../../../crm/services/customerMock'
import { resetMockStore as resetCustomerMockStore } from '../../../crm/services/customerMock'
import { formatMoney } from '../../../../utils/formatMoney'

// Mock de useRouter para verificar navegaciones
const mockNavigate = vi.fn()
vi.mock('../../../../app/router', () => ({
  useRouter: () => ({
    navigate: mockNavigate,
    pathname: '/pos/new',
    route: { path: '/pos/new', label: 'Nueva venta' },
  }),
}))

describe('NewSalePage', () => {
  let posRepo: PosMockRepository
  let invRepo: InventoryMockRepository
  let custRepo: CustomerMockRepository

  beforeEach(() => {
    vi.clearAllMocks()
    resetPosMockStore()
    resetInventoryMockStore()
    resetCustomerMockStore()

    posRepo = new PosMockRepository()
    invRepo = new InventoryMockRepository()
    custRepo = new CustomerMockRepository()
  })

  it('renderiza la cabecera hero, las tarjetas Bento y carga los clientes', async () => {
    render(
      <NewSalePage
        posRepository={posRepo}
        inventoryRepository={invRepo}
        customerRepository={custRepo}
      />
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Nueva venta' })).toBeInTheDocument()
    expect(screen.getByText(/Emisión de comprobante comercial/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Datos de la transacción' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Ítems y productos' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Resumen de venta' })).toBeInTheDocument()

    // Comprobar punto de emisión
    const establishmentInput = screen.getByLabelText(/punto de emisión/i)
    expect(establishmentInput).toHaveValue('001-001 Matriz')
  })

  it('permite buscar y seleccionar un cliente de la lista', async () => {
    const user = userEvent.setup()
    render(
      <NewSalePage
        posRepository={posRepo}
        inventoryRepository={invRepo}
        customerRepository={custRepo}
      />
    )

    const customerInput = screen.getByLabelText('Buscar o ingresar cliente')
    await user.click(customerInput)

    // Despliega opciones de clientes
    await waitFor(() => {
      expect(screen.getByText('Carlos Alberto Mendoza')).toBeInTheDocument()
    })

    // Seleccionar cliente
    await user.click(screen.getByText('Carlos Alberto Mendoza'))

    // El input refleja el nombre y muestra el indicador de seleccionado
    expect(customerInput).toHaveValue('Carlos Alberto Mendoza - 1790000001')
    expect(screen.getByText('✓ Cliente seleccionado')).toBeInTheDocument()
  })

  it('permite agregar un producto del inventario mediante el modal y editar la cantidad', async () => {
    const user = userEvent.setup()
    render(
      <NewSalePage
        posRepository={posRepo}
        inventoryRepository={invRepo}
        customerRepository={custRepo}
      />
    )

    // Abrir modal de productos
    const addProductBtn = screen.getByRole('button', { name: '+ Agregar producto' })
    await user.click(addProductBtn)

    // Modal abierto
    expect(
      await screen.findByRole('heading', { name: 'Seleccionar producto de inventario' })
    ).toBeInTheDocument()

    // Buscar "Cemento"
    const modalSearch = screen.getByLabelText('Buscar producto en el inventario')
    await user.type(modalSearch, 'Cemento')

    // Click en "Agregar" para Cemento Portland
    const addCementoBtn = await screen.findByRole('button', {
      name: 'Seleccionar Cemento Portland Tipo I (50kg)',
    })
    await user.click(addCementoBtn)

    // El producto aparece en la tabla
    await waitFor(() => {
      expect(screen.getByText('Cemento Portland Tipo I (50kg)')).toBeInTheDocument()
      expect(screen.getByText('MAT-2026-081')).toBeInTheDocument()
    })

    // Editar cantidad a 5
    const qtyInput = screen.getByLabelText('Cantidad para Cemento Portland Tipo I (50kg)')
    await user.clear(qtyInput)
    await user.type(qtyInput, '5')

    expect(qtyInput).toHaveValue(5)
  })

  it('calcula subtotales, IVA 15% y total en tiempo real', async () => {
    const user = userEvent.setup()
    render(
      <NewSalePage
        posRepository={posRepo}
        inventoryRepository={invRepo}
        customerRepository={custRepo}
      />
    )

    // Cemento ($8.50 USD = 850 centavos)
    const addProductBtn = screen.getByRole('button', { name: '+ Agregar producto' })
    await user.click(addProductBtn)
    const addCementoBtn = await screen.findByRole('button', {
      name: 'Seleccionar Cemento Portland Tipo I (50kg)',
    })
    await user.click(addCementoBtn)

    // Esperar a que el producto aparezca en la tabla
    await waitFor(() => {
      expect(screen.getByText('Cemento Portland Tipo I (50kg)')).toBeInTheDocument()
    })

    // Con cantidad 1:
    // Subtotal gravado: formatMoney(850)
    // IVA 15%: round(850 * 0.15) = 128 centavos -> formatMoney(128)
    // Total: 850 + 128 = 978 -> formatMoney(978)
    expect(
      screen.getAllByText((content) => content.includes(formatMoney(850))).length
    ).toBeGreaterThanOrEqual(1)
    expect(
      screen.getByText((content) => content.includes(formatMoney(128)))
    ).toBeInTheDocument()
    expect(
      screen.getByText((content) => content.includes(formatMoney(978)))
    ).toBeInTheDocument()

    // Cambiar cantidad a 2:
    // Subtotal = 2 * 8.50 = 1700 -> formatMoney(1700)
    // IVA 15%: round(1700 * 0.15) = 255 -> formatMoney(255)
    // Total: 1700 + 255 = 1955 -> formatMoney(1955)
    const qtyInput = screen.getByLabelText('Cantidad para Cemento Portland Tipo I (50kg)')
    await user.clear(qtyInput)
    await user.type(qtyInput, '2')

    await waitFor(() => {
      expect(
        screen.getAllByText((content) => content.includes(formatMoney(1700))).length
      ).toBeGreaterThanOrEqual(1)
      expect(
        screen.getByText((content) => content.includes(formatMoney(255)))
      ).toBeInTheDocument()
      expect(
        screen.getByText((content) => content.includes(formatMoney(1955)))
      ).toBeInTheDocument()
    })
  })

  it('emite una venta con éxito, muestra la pantalla de confirmación y actualiza inventario', async () => {
    const user = userEvent.setup()
    render(
      <NewSalePage
        posRepository={posRepo}
        inventoryRepository={invRepo}
        customerRepository={custRepo}
      />
    )

    // 1. Seleccionar cliente
    const customerInput = screen.getByLabelText('Buscar o ingresar cliente')
    await user.click(customerInput)
    await waitFor(() => {
      expect(screen.getByText('Carlos Alberto Mendoza')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Carlos Alberto Mendoza'))

    // 2. Agregar producto
    await user.click(screen.getByRole('button', { name: '+ Agregar producto' }))
    const addCementoBtn = await screen.findByRole('button', {
      name: 'Seleccionar Cemento Portland Tipo I (50kg)',
    })
    await user.click(addCementoBtn)

    // 3. Emitir venta
    const submitBtn = screen.getByRole('button', { name: 'Emitir venta' })
    await user.click(submitBtn)

    // 4. Se muestra la vista de éxito con el comprobante emitido
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: '¡Venta emitida con éxito!' })).toBeInTheDocument()
      expect(screen.getByText('001-001-000000109')).toBeInTheDocument()
    })

    // Verificar que el stock disminuyó en inventario (de 18 a 17)
    const currentStock = await invRepo.getAvailability('prd-andina-001')
    expect(currentStock).toBe(17)

    // Click en "Ver listado de ventas" navega a /pos
    const viewSalesBtn = screen.getByRole('button', { name: 'Ver listado de ventas' })
    await user.click(viewSalesBtn)
    expect(mockNavigate).toHaveBeenCalledWith('/pos')
  })

  it('muestra error accesible si se intenta emitir sin cliente o sin productos', async () => {
    const user = userEvent.setup()
    render(
      <NewSalePage
        posRepository={posRepo}
        inventoryRepository={invRepo}
        customerRepository={custRepo}
      />
    )

    // Clic en emitir sin datos
    const submitBtn = screen.getByRole('button', { name: 'Emitir venta' })
    await user.click(submitBtn)

    expect(
      screen.getByText(/Debes seleccionar o especificar un cliente/i)
    ).toBeInTheDocument()
  })

  it('muestra alerta de stock insuficiente y no confirma la venta', async () => {
    const user = userEvent.setup()
    render(
      <NewSalePage
        posRepository={posRepo}
        inventoryRepository={invRepo}
        customerRepository={custRepo}
      />
    )

    // 1. Seleccionar cliente
    const customerInput = screen.getByLabelText('Buscar o ingresar cliente')
    await user.click(customerInput)
    await waitFor(() => {
      expect(screen.getByText('Carlos Alberto Mendoza')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Carlos Alberto Mendoza'))

    // 2. Agregar Disco de Corte (stock disponible: 6)
    await user.click(screen.getByRole('button', { name: '+ Agregar producto' }))
    const addDiscoBtn = await screen.findByRole('button', {
      name: 'Seleccionar Disco de Corte Diamantado 7"',
    })
    await user.click(addDiscoBtn)

    // 3. Colocar cantidad 20 (supera stock 6)
    const qtyInput = screen.getByLabelText('Cantidad para Disco de Corte Diamantado 7"')
    await user.clear(qtyInput)
    await user.type(qtyInput, '20')

    // 4. Intentar emitir
    const submitBtn = screen.getByRole('button', { name: 'Emitir venta' })
    await user.click(submitBtn)

    // Alerta accesible de stock insuficiente
    await waitFor(() => {
      expect(screen.getByText(/Stock insuficiente para "Disco de Corte Diamantado 7""/i)).toBeInTheDocument()
    })

    // No se generó la venta
    expect(screen.queryByRole('heading', { name: '¡Venta emitida con éxito!' })).not.toBeInTheDocument()

    // El stock en inventario sigue intacto
    const stockAfter = await invRepo.getAvailability('prd-andina-004')
    expect(stockAfter).toBe(6)
  })

  it('abre el diálogo de confirmación al hacer clic en "Cancelar transacción" si hay datos', async () => {
    const user = userEvent.setup()
    render(
      <NewSalePage
        posRepository={posRepo}
        inventoryRepository={invRepo}
        customerRepository={custRepo}
      />
    )

    // Agregar producto para ensuciar el formulario
    await user.click(screen.getByRole('button', { name: '+ Agregar producto' }))
    const addCementoBtn = await screen.findByRole('button', {
      name: 'Seleccionar Cemento Portland Tipo I (50kg)',
    })
    await user.click(addCementoBtn)

    // Clic en Cancelar transacción
    const cancelBtn = screen.getByRole('button', { name: 'Cancelar transacción' })
    await user.click(cancelBtn)

    // Diálogo de confirmación accesible abierto
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText('¿Descartar transacción?')).toBeInTheDocument()

    // Confirmar descarte
    const confirmDiscardBtn = within(dialog).getByRole('button', { name: 'Sí, descartar' })
    await user.click(confirmDiscardBtn)

    expect(mockNavigate).toHaveBeenCalledWith('/pos')
  })
})
