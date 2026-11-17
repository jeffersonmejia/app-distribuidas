import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Select } from './Select'

describe('Select Component', () => {
  const options = [
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
  ]

  it('asocia el label al select mediante htmlFor/id', () => {
    render(<Select id="status" label="Estado" options={options} />)
    expect(screen.getByLabelText('Estado')).toBeInTheDocument()
  })

  it('permite cambiar la opción seleccionada', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <Select
        id="status"
        label="Estado"
        options={options}
        onChange={handleChange}
        defaultValue="active"
      />
    )

    const select = screen.getByLabelText('Estado')
    await user.selectOptions(select, 'inactive')
    expect(handleChange).toHaveBeenCalled()
    expect(select).toHaveValue('inactive')
  })

  it('aplica aria-invalid y muestra el mensaje de error cuando se pasa error', () => {
    render(
      <Select
        id="status"
        label="Estado"
        options={options}
        error="Selección requerida"
      />
    )

    const select = screen.getByLabelText('Estado')
    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Selección requerida')
  })

  it('deshabilita el control cuando se pasa disabled', () => {
    render(<Select id="status" label="Estado" options={options} disabled />)
    expect(screen.getByLabelText('Estado')).toBeDisabled()
  })

  it('muestra el texto de ayuda hint cuando se pasa', () => {
    render(<Select id="status" label="Estado" options={options} hint="Selecciona el estado inicial" />)
    expect(screen.getByText('Selecciona el estado inicial')).toBeInTheDocument()
  })
})
