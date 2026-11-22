import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SessionProvider } from './SessionProvider'
import { useSession } from '../hooks/useSession'
import type { SessionRepository } from '../services/sessionRepository'
import type { SessionUser, Tenant } from '../types/session'

const TEST_TENANT: Tenant = {
  id: 't1',
  name: 'Tenant Uno S.A.',
  tier: 'Pyme',
}

const TEST_USER: SessionUser = {
  id: 'usr-test',
  fullName: 'Usuario Prueba',
  email: 'prueba@ficcion.test',
  role: 'Operador',
  initials: 'UP',
  tenantId: TEST_TENANT.id,
  tenantName: TEST_TENANT.name,
  tenant: TEST_TENANT,
}

function makeSessionRepo(overrides: Partial<SessionRepository> = {}): SessionRepository {
  return {
    getCurrentUser: vi.fn<() => Promise<SessionUser | null>>().mockResolvedValue(TEST_USER),
    getCurrentTenant: vi.fn<() => Promise<Tenant | null>>().mockResolvedValue(TEST_TENANT),
    signOut: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    ...overrides,
  }
}

function Consumer() {
  const { user, tenant, signOut, isLoading } = useSession()

  if (isLoading) return <div>Cargando sesión...</div>

  return (
    <div>
      <span data-testid="user-name">{user ? user.fullName : 'Sin usuario'}</span>
      <span data-testid="active-tenant">{tenant ? tenant.name : 'Sin tenant'}</span>
      <button onClick={() => void signOut()}>Salir</button>
    </div>
  )
}

describe('SessionProvider y useSession', () => {
  it('provee los datos del usuario y el tenant cargados automáticamente', async () => {
    const repo = makeSessionRepo()
    render(
      <SessionProvider repository={repo}>
        <Consumer />
      </SessionProvider>,
    )

    expect(await screen.findByTestId('user-name')).toHaveTextContent('Usuario Prueba')
    expect(screen.getByTestId('active-tenant')).toHaveTextContent('Tenant Uno S.A.')
  })

  it('permite cerrar sesión y limpia el usuario y tenant', async () => {
    const repo = makeSessionRepo()
    render(
      <SessionProvider repository={repo}>
        <Consumer />
      </SessionProvider>,
    )

    await screen.findByTestId('user-name')
    fireEvent.click(screen.getByRole('button', { name: /salir/i }))

    await waitFor(() => {
      expect(repo.signOut).toHaveBeenCalled()
    })
    expect(screen.getByTestId('user-name')).toHaveTextContent('Sin usuario')
    expect(screen.getByTestId('active-tenant')).toHaveTextContent('Sin tenant')
  })
})
