import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pagination } from './Pagination'

describe('Pagination Component', () => {
  it('muestra el número de página base 1 (Página 1 para índice 0)', () => {
    render(<Pagination currentPage={0} hasNext={true} onPageChange={vi.fn()} />)
    expect(screen.getByText('Página 1')).toBeInTheDocument()
  })

  it('deshabilita el botón Anterior en la página 0', () => {
    render(<Pagination currentPage={0} hasNext={true} onPageChange={vi.fn()} />)
    const prevBtn = screen.getByRole('button', { name: 'Ir a página anterior' })
    const nextBtn = screen.getByRole('button', { name: 'Ir a página siguiente' })

    expect(prevBtn).toBeDisabled()
    expect(nextBtn).not.toBeDisabled()
  })

  it('deshabilita el botón Siguiente si hasNext es false', () => {
    render(<Pagination currentPage={2} hasNext={false} onPageChange={vi.fn()} />)
    const nextBtn = screen.getByRole('button', { name: 'Ir a página siguiente' })
    expect(nextBtn).toBeDisabled()
  })

  it('llama a onPageChange con el índice correcto al hacer clic en Anterior o Siguiente', async () => {
    const user = userEvent.setup()
    const handlePageChange = vi.fn()

    render(<Pagination currentPage={1} hasNext={true} onPageChange={handlePageChange} />)

    const prevBtn = screen.getByRole('button', { name: 'Ir a página anterior' })
    await user.click(prevBtn)
    expect(handlePageChange).toHaveBeenCalledWith(0)

    const nextBtn = screen.getByRole('button', { name: 'Ir a página siguiente' })
    await user.click(nextBtn)
    expect(handlePageChange).toHaveBeenCalledWith(2)
  })

  it('deshabilita ambos botones cuando isLoading es true', () => {
    render(<Pagination currentPage={1} hasNext={true} onPageChange={vi.fn()} isLoading={true} />)
    expect(screen.getByRole('button', { name: 'Ir a página anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Ir a página siguiente' })).toBeDisabled()
  })

  it('muestra el resumen de conteo cuando se pasa itemsCount', () => {
    render(<Pagination currentPage={0} hasNext={true} onPageChange={vi.fn()} itemsCount={5} />)
    expect(screen.getByText(/mostrando/i)).toHaveTextContent('Mostrando 5 clientes (Página 1)')
  })

  it('muestra la etiqueta en singular cuando itemsCount es 1', () => {
    render(<Pagination currentPage={0} hasNext={false} onPageChange={vi.fn()} itemsCount={1} />)
    expect(screen.getByText(/mostrando/i)).toHaveTextContent('Mostrando 1 cliente (Página 1)')
  })

  it('permite personalizar el sustantivo mediante itemLabel e itemLabelPlural', () => {
    const { rerender } = render(
      <Pagination
        currentPage={0}
        hasNext={true}
        onPageChange={vi.fn()}
        itemsCount={5}
        itemLabel="producto"
        itemLabelPlural="productos"
      />
    )
    expect(screen.getByText(/mostrando/i)).toHaveTextContent('Mostrando 5 productos (Página 1)')

    rerender(
      <Pagination
        currentPage={0}
        hasNext={false}
        onPageChange={vi.fn()}
        itemsCount={1}
        itemLabel="producto"
        itemLabelPlural="productos"
      />
    )
    expect(screen.getByText(/mostrando/i)).toHaveTextContent('Mostrando 1 producto (Página 1)')
  })
})
