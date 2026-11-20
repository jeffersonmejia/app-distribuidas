// SOLID: SRP — REPOSITORIO EN MEMORIA PARA LA GESTIÓN DE SESIÓN SIMULADA CON TENANT RESUELTO DESDE EL USUARIO.

import type { SessionUser, Tenant } from '../types/session'
import type { SessionRepository } from './sessionRepository'

const STORAGE_KEY_AUTH = 'app_session_authenticated'

export const MOCK_TENANT: Tenant = {
  id: 'tnt-andina-001',
  name: 'Andina Importaciones S.A.',
  tier: 'Plan Pyme',
}

export const MOCK_USER: SessionUser = {
  id: 'usr-00000001-0000-0000-0000-000000000001',
  fullName: 'Carlos Alberto Mendoza',
  email: 'carlos.mendoza@ficcion.test',
  role: 'Administrador Comercial',
  initials: 'CM',
  tenantId: MOCK_TENANT.id,
  tenantName: MOCK_TENANT.name,
  tenant: MOCK_TENANT,
}

let isSessionActive = true

function getSafeLocalStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function setSafeLocalStorageItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Si localStorage no está disponible o falla, se ignora silenciosamente
  }
}

function removeSafeLocalStorageItem(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Si localStorage no está disponible o falla, se ignora silenciosamente
  }
}

// SOLID: SRP — IMPLEMENTA EL REPOSITORIO DE SESIÓN CON TENANT ASOCIADO DIRECTAMENTE AL USUARIO.
export class SessionMockRepository implements SessionRepository {
  async getCurrentUser(): Promise<SessionUser | null> {
    const authStored = getSafeLocalStorageItem(STORAGE_KEY_AUTH)
    if (authStored === 'false') {
      return null
    }
    if (!isSessionActive && authStored !== 'true') {
      return null
    }
    return MOCK_USER
  }

  async getCurrentTenant(): Promise<Tenant | null> {
    const user = await this.getCurrentUser()
    if (!user) return null
    return user.tenant ?? {
      id: user.tenantId,
      name: user.tenantName,
    }
  }

  async signIn(_email?: string): Promise<SessionUser> {
    isSessionActive = true
    setSafeLocalStorageItem(STORAGE_KEY_AUTH, 'true')
    return MOCK_USER
  }

  async signOut(): Promise<void> {
    isSessionActive = false
    setSafeLocalStorageItem(STORAGE_KEY_AUTH, 'false')
  }
}

/** Permite reiniciar el estado del mock en pruebas */
export function resetSessionMockStore(): void {
  isSessionActive = true
  removeSafeLocalStorageItem(STORAGE_KEY_AUTH)
}
