import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TenantSelector } from './TenantSelector'
import { renderWithProviders, cleanupSessionTestState } from '../../../../test/renderWithProviders'

describe('TenantSelector', () => {
  beforeEach(() => {
    cleanupSessionTestState()
  })

  afterEach(() => {
    cleanupSessionTestState()
  })

  it('renderiza el botón de activación con el avatar e iniciales de la organización', async () => {
    renderWithProviders(<TenantSelector />)

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /organización activa: andina importaciones s\.a\./i })
      ).toBeInTheDocument()
    })
  })

  it('despliega la lista de organizaciones al hacer clic en el botón', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TenantSelector />)

    const trigger = await screen.findByRole('button', {
      name: /organización activa: andina importaciones s\.a\./i,
    })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('listbox', { name: /seleccionar organización/i })).toBeInTheDocument()

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)
    expect(options[0]).toHaveTextContent(/andina importaciones s\.a\./i)
    expect(options[1]).toHaveTextContent(/distribuidora del pacífico/i)
    expect(options[2]).toHaveTextContent(/industrias del austro/i)
  })

  it('permite cambiar el tenant activo al seleccionar una opción', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TenantSelector />)

    const trigger = await screen.findByRole('button', {
      name: /organización activa: andina importaciones s\.a\./i,
    })
    await user.click(trigger)

    const optionPacifico = screen.getByRole('option', {
      name: /distribuidora del pacífico/i,
    })
    await user.click(optionPacifico)

    // El dropdown se cierra y el botón refleja la nueva organización
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /organización activa: distribuidora del pacífico/i,
        })
      ).toBeInTheDocument()
    })
  })

  it('cierra el dropdown con la tecla Escape', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TenantSelector />)

    const trigger = await screen.findByRole('button', {
      name: /organización activa: andina importaciones s\.a\./i,
    })
    await user.click(trigger)

    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })
})
