import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SessionProvider } from './SessionProvider'
import { useSession } from '../hooks/useSession'
import type { SessionRepository } from '../services/sessionRepository'
import type { SessionUser, Tenant } from '../types/session'

const TEST_USER: SessionUser = {
  id: 'usr-test',
  fullName: 'Usuario Prueba',
  email: 'prueba@ficcion.test',
  role: 'Operador',
  initials: 'UP',
}

const TEST_TENANTS: Tenant[] = [
  { id: 't1', name: 'Tenant Uno', tier: 'Pyme' },
  { id: 't2', name: 'Tenant Dos', tier: 'Pro' },
]

function makeSessionRepo(overrides: Partial<SessionRepository> = {}): SessionRepository {
  let activeId = 't1'
  return {
    getCurrentUser: vi.fn<() => Promise<SessionUser | null>>().mockResolvedValue(TEST_USER),
    listTenants: vi.fn<() => Promise<Tenant[]>>().mockResolvedValue(TEST_TENANTS),
    getActiveTenantId: vi.fn<() => Promise<string | null>>().mockImplementation(async () => activeId),
    setActiveTenant: vi.fn<(id: string) => Promise<void>>().mockImplementation(async (id: string) => {
      activeId = id
    }),
    signOut: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    ...overrides,
  }
}

function Consumer() {
  const { user, tenants, activeTenant, setActiveTenant, signOut, isLoading } = useSession()

  if (isLoading) return <div>Cargando sesión...</div>

  return (
    <div>
      <span data-testid="user-name">{user ? user.fullName : 'Sin usuario'}</span>
      <span data-testid="active-tenant">{activeTenant ? activeTenant.name : 'Sin tenant'}</span>
      <span data-testid="tenants-count">{tenants.length}</span>
      <button onClick={() => void setActiveTenant('t2')}>Cambiar a t2</button>
      <button onClick={() => void signOut()}>Salir</button>
    </div>
  )
}

describe('SessionProvider y useSession', () => {
  it('provee los datos del usuario y los tenants cargados', async () => {
    const repo = makeSessionRepo()
    render(
      <SessionProvider repository={repo}>
        <Consumer />
      </SessionProvider>,
    )

    expect(await screen.findByTestId('user-name')).toHaveTextContent('Usuario Prueba')
    expect(screen.getByTestId('active-tenant')).toHaveTextContent('Tenant Uno')
    expect(screen.getByTestId('tenants-count')).toHaveTextContent('2')
  })

  it('permite cambiar el tenant activo mediante setActiveTenant', async () => {
    const repo = makeSessionRepo()
    render(
      <SessionProvider repository={repo}>
        <Consumer />
      </SessionProvider>,
    )

    await screen.findByTestId('user-name')
    fireEvent.click(screen.getByRole('button', { name: /cambiar a t2/i }))

    await waitFor(() => {
      expect(repo.setActiveTenant).toHaveBeenCalledWith('t2')
    })
    expect(screen.getByTestId('active-tenant')).toHaveTextContent('Tenant Dos')
  })

  it('limpia el usuario y el tenant activo al hacer signOut', async () => {
    const repo = makeSessionRepo()
    render(
      <SessionProvider repository={repo}>
        <Consumer />
      </SessionProvider>,
    )

    await screen.findByTestId('user-name')
    fireEvent.click(screen.getByRole('button', { name: /salir/i }))

    await waitFor(() => {
      expect(repo.signOut).toHaveBeenCalledOnce()
    })
    expect(screen.getByTestId('user-name')).toHaveTextContent('Sin usuario')
    expect(screen.getByTestId('active-tenant')).toHaveTextContent('Sin tenant')
  })

  it('useSession lanza un error descriptivo si se usa fuera de SessionProvider', () => {
    // Silencia el error de render de react en consola para esta prueba
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Consumer />)).toThrow(
      /useSession debe utilizarse dentro de un SessionProvider/i,
    )
    consoleError.mockRestore()
  })
})
