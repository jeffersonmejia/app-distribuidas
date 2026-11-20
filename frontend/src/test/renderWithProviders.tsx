// SOLID: SRP — UTILIDAD PARA RENDERIZAR COMPONENTES CON PROVEEDORES DE ENRUTAMIENTO Y SESIÓN AISLADOS EN PRUEBAS.

import type { ReactElement } from 'react'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import { RouterProvider } from '../app/router'
import { SessionProvider } from '../features/identity/context'
import {
  SessionMockRepository,
  resetSessionMockStore,
  MOCK_USER,
  MOCK_TENANTS,
} from '../features/identity/services/sessionMock'
import type { SessionRepository } from '../features/identity/services/sessionRepository'

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  initialPath?: string
  authenticated?: boolean
  repository?: SessionRepository
}

/**
 * Repositorio de sesión para pruebas que permite configurar explícitamente
 * si la sesión inicial se encuentra autenticada o no.
 */
class ConfigurableTestSessionRepository extends SessionMockRepository {
  private customAuthenticated: boolean

  constructor(authenticated: boolean) {
    super()
    this.customAuthenticated = authenticated
  }

  override async getCurrentUser() {
    if (!this.customAuthenticated) {
      return null
    }
    return MOCK_USER
  }

  override async listTenants() {
    return [...MOCK_TENANTS]
  }

  override async signIn(email?: string) {
    this.customAuthenticated = true
    return super.signIn(email)
  }

  override async signOut() {
    this.customAuthenticated = false
    await super.signOut()
  }
}

/**
 * Limpia el estado de almacenamiento local y los singletons en memoria de sesión.
 */
export function cleanupSessionTestState(): void {
  try {
    localStorage.clear()
  } catch {
    // Silencioso en caso de no estar disponible
  }
  resetSessionMockStore()
}

/**
 * Renderiza un componente envuelto con RouterProvider y SessionProvider configurados.
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: RenderWithProvidersOptions
): RenderResult {
  const {
    initialPath = '/',
    authenticated = true,
    repository,
    ...renderOptions
  } = options ?? {}

  const repo = repository ?? new ConfigurableTestSessionRepository(authenticated)

  function ProvidersWrapper({ children }: { children: React.ReactNode }) {
    return (
      <SessionProvider repository={repo}>
        <RouterProvider initialPath={initialPath}>
          {children}
        </RouterProvider>
      </SessionProvider>
    )
  }

  return render(ui, { wrapper: ProvidersWrapper, ...renderOptions })
}
