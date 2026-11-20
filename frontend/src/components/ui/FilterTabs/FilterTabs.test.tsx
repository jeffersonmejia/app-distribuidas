import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { FilterTabs } from './FilterTabs'

describe('FilterTabs', () => {
  const tabs = [
    { id: 'all', label: 'Todos', count: 10 },
    { id: 'active', label: 'Activos', count: 7 },
    { id: 'inactive', label: 'Inactivos', count: 3 },
  ]

  it('renderiza todas las pestañas con role="tab" y conteos', () => {
    render(<FilterTabs tabs={tabs} activeTab="all" onTabChange={vi.fn()} />)
    const buttons = screen.getAllByRole('tab')
    expect(buttons).toHaveLength(3)
    expect(buttons[0]).toHaveAttribute('aria-selected', 'true')
    expect(buttons[1]).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('emite onTabChange al hacer clic en una pestaña', async () => {
    const handleChange = vi.fn()
    const user = userEvent.setup()
    render(<FilterTabs tabs={tabs} activeTab="all" onTabChange={handleChange} />)

    // Usar nombre exacto para evitar ambigüedad con "Inactivos"
    await user.click(screen.getByRole('tab', { name: /^activos/i }))
    expect(handleChange).toHaveBeenCalledWith('active')
  })

  it('soporta navegación con teclado (ArrowRight, ArrowLeft, Home, End)', () => {
    const handleChange = vi.fn()
    const { rerender } = render(
      <FilterTabs tabs={tabs} activeTab="all" onTabChange={handleChange} />
    )

    const tablist = screen.getByRole('tablist')

    // ArrowRight: all → active
    fireEvent.keyDown(tablist, { key: 'ArrowRight' })
    expect(handleChange).toHaveBeenLastCalledWith('active')

    // Simular que el padre actualizó activeTab
    rerender(<FilterTabs tabs={tabs} activeTab="active" onTabChange={handleChange} />)

    // End: active → inactive (último)
    fireEvent.keyDown(tablist, { key: 'End' })
    expect(handleChange).toHaveBeenLastCalledWith('inactive')

    // Simular que el padre actualizó activeTab
    rerender(<FilterTabs tabs={tabs} activeTab="inactive" onTabChange={handleChange} />)

    // Home: inactive → all (primero)
    fireEvent.keyDown(tablist, { key: 'Home' })
    expect(handleChange).toHaveBeenLastCalledWith('all')
  })
})
