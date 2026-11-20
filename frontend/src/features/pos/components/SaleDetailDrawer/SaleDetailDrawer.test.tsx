import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SaleDetailDrawer } from './SaleDetailDrawer'
import { PosMockRepository, resetPosMockStore } from '../../services/posMock'
import { PosApiError, type PosRepository } from '../../services/posRepository'

describe('SaleDetailDrawer', () => {
  let mockRepo: PosRepository

  beforeEach(() => {
    resetPosMockStore()
    mockRepo = new PosMockRepository()
  })

  it('no muestra contenido si isOpen es false o no hay saleId', () => {
    const { container } = render(
      <SaleDetailDrawer
        isOpen={false}
        onClose={vi.fn()}
        saleId={null}
        repository={mockRepo}
      />
    )
    expect(screen.queryByText('Datos del cliente')).not.toBeInTheDocument()
    expect(container.querySelector('.drawer-panel--open')).not.toBeInTheDocument()
  })

  it('carga y muestra la información completa del comprobante seleccionado', async () => {
    render(
      <SaleDetailDrawer
        isOpen={true}
        onClose={vi.fn()}
        saleId="sal-andina-001"
        repository={mockRepo}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('001-001-000000101')).toBeInTheDocument()
    })

    expect(screen.getByText('Constructora del Valle S.A.')).toBeInTheDocument()
    expect(screen.getByText('1792019482001')).toBeInTheDocument()
    expect(screen.getByText('Cemento Portland Tipo I (50kg)')).toBeInTheDocument()
    expect(screen.getByText('Pagada')).toBeInTheDocument()
    expect(screen.getByText('Liquidación económica')).toBeInTheDocument()
  })

  it('muestra error si el comprobante no existe', async () => {
    const failingRepo: PosRepository = {
      list: vi.fn(),
      getById: vi.fn().mockRejectedValue(new PosApiError('Comprobante inexistente', 'not_found')),
    }

    render(
      <SaleDetailDrawer
        isOpen={true}
        onClose={vi.fn()}
        saleId="id-inexistente"
        repository={failingRepo}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Comprobante inexistente')).toBeInTheDocument()
    })
  })

  it('llama a onClose al presionar el botón de cerrar', async () => {
    const user = userEvent.setup()
    const handleClose = vi.fn()

    render(
      <SaleDetailDrawer
        isOpen={true}
        onClose={handleClose}
        saleId="sal-andina-001"
        repository={mockRepo}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('001-001-000000101')).toBeInTheDocument()
    })

    const closeBtn = screen.getByRole('button', { name: /^cerrar$/i })
    await user.click(closeBtn)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})
