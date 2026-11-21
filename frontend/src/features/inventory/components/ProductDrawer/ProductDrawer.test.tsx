import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProductDrawer } from './ProductDrawer'
import type { InventoryRepository } from '../../services'
import type { Product } from '../../types/product'

function makeMockRepository(overrides: Partial<InventoryRepository> = {}): InventoryRepository {
  return {
    list: vi.fn(),
    create: vi.fn<(input: any) => Promise<Product>>().mockResolvedValue({
      id: 'prd-new',
      name: 'Nuevo Tubo PVC',
      sku: 'TUB-001',
      category: 'Materiales',
      purchasePriceCents: 500,
      sellingPriceCents: 800,
      stock: 15,
      minStock: 5,
      status: 'available',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }),
    ...overrides,
  }
}

describe('ProductDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza todos los campos del formulario de producto de Stitch', () => {
    const repo = makeMockRepository()
    render(
      <ProductDrawer
        isOpen={true}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        repository={repo}
      />
    )

    expect(screen.getByRole('heading', { name: 'Nuevo producto' })).toBeInTheDocument()
    expect(screen.getByLabelText(/nombre del producto/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/código \/ sku/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/categoría/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/descripción técnica/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/precio de compra/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/precio de venta/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/stock inicial/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/stock mínimo/i)).toBeInTheDocument()
  })

  it('muestra mensajes de validación al enviar campos requeridos vacíos', async () => {
    const repo = makeMockRepository()
    const user = userEvent.setup()

    render(
      <ProductDrawer
        isOpen={true}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        repository={repo}
      />
    )

    // El botón Guardar producto envía el formulario
    await user.click(screen.getByRole('button', { name: /guardar producto/i }))

    expect(await screen.findByText(/el nombre del producto es obligatorio/i)).toBeInTheDocument()
    expect(screen.getByText(/el código \/ sku es obligatorio/i)).toBeInTheDocument()
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('llama a repository.create y onCreated al completar el formulario correctamente', async () => {
    const repo = makeMockRepository()
    const onCreated = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(
      <ProductDrawer
        isOpen={true}
        onClose={onClose}
        onCreated={onCreated}
        repository={repo}
      />
    )

    await user.type(screen.getByLabelText(/nombre del producto/i), 'Viga de Acero')
    await user.type(screen.getByLabelText(/código \/ sku/i), 'VIG-001')
    await user.click(screen.getByRole('button', { name: /guardar producto/i }))

    await waitFor(() => {
      expect(repo.create).toHaveBeenCalled()
      expect(onCreated).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })
})
