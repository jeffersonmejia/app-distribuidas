import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MetricCard } from './MetricCard'

describe('MetricCard', () => {
  it('renderiza título y valor correctamente', () => {
    render(<MetricCard title="Total Clientes" value={230} />)
    expect(screen.getByText('Total Clientes')).toBeInTheDocument()
    expect(screen.getByText('230')).toBeInTheDocument()
  })

  it('renderiza subtítulo y badge opcionales', () => {
    render(
      <MetricCard
        title="Stock Bajo"
        value={12}
        subtitle="Requieren reposición inmediata"
        badge={<span>Atención</span>}
      />
    )
    expect(screen.getByText('Stock Bajo')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('Requieren reposición inmediata')).toBeInTheDocument()
    expect(screen.getByText('Atención')).toBeInTheDocument()
  })

  it('renderiza icono con aria-hidden', () => {
    render(
      <MetricCard
        title="Ingresos"
        value="$84,320.00"
        icon={<svg data-testid="icon" />}
        iconVariant="success"
      />
    )
    const iconWrapper = screen.getByTestId('icon').parentElement
    expect(iconWrapper).toHaveAttribute('aria-hidden', 'true')
    expect(iconWrapper).toHaveClass('ui-metric-card__icon-wrapper--success')
  })
})
