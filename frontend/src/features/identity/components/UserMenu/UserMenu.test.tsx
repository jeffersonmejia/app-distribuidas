import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserMenu } from './UserMenu'
import { SessionProvider } from '../../context'
import { resetSessionMockStore } from '../../services/sessionMock'

describe('UserMenu', () => {
  beforeEach(() => {
    resetSessionMockStore()
  })

  it('renderiza el botón de perfil con las iniciales del usuario', async () => {
    render(
      <SessionProvider>
        <UserMenu />
      </SessionProvider>
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /cuenta de usuario: carlos alberto mendoza/i })
      ).toBeInTheDocument()
    })
  })

  it('despliega el menú al pulsar el botón mostrando datos de usuario', async () => {
    const user = userEvent.setup()
    render(
      <SessionProvider>
        <UserMenu />
      </SessionProvider>
    )

    const trigger = await screen.findByRole('button', {
      name: /cuenta de usuario: carlos alberto mendoza/i,
    })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu', { name: /opciones de usuario/i })).toBeInTheDocument()
    expect(screen.getByText('Carlos Alberto Mendoza')).toBeInTheDocument()
    expect(screen.getByText('carlos.mendoza@ficcion.test')).toBeInTheDocument()
    expect(screen.getByText('Administrador Comercial')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /cerrar sesión/i })).toBeInTheDocument()
  })

  it('cierra el menú al presionar Escape', async () => {
    const user = userEvent.setup()
    render(
      <SessionProvider>
        <UserMenu />
      </SessionProvider>
    )

    const trigger = await screen.findByRole('button', {
      name: /cuenta de usuario: carlos alberto mendoza/i,
    })
    await user.click(trigger)

    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })

  it('cierra la sesión al hacer clic en "Cerrar sesión"', async () => {
    const user = userEvent.setup()
    render(
      <SessionProvider>
        <UserMenu />
      </SessionProvider>
    )

    const trigger = await screen.findByRole('button', {
      name: /cuenta de usuario: carlos alberto mendoza/i,
    })
    await user.click(trigger)

    const logoutBtn = screen.getByRole('menuitem', { name: /cerrar sesión/i })
    await user.click(logoutBtn)

    await waitFor(() => {
      // Al cerrar sesión, user es null y UserMenu retorna null
      expect(
        screen.queryByRole('button', { name: /cuenta de usuario/i })
      ).not.toBeInTheDocument()
    })
  })
})
