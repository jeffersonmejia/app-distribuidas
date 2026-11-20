// SOLID: SRP — REPOSITORIO EN MEMORIA PARA LA GESTIÓN DE SESIÓN Y MULTITENANCY SIMULADOS.

import type { SessionUser, Tenant } from '../types/session'
import type { SessionRepository } from './sessionRepository'

const STORAGE_KEY_TENANT = 'app_active_tenant_id'
const STORAGE_KEY_AUTH = 'app_session_authenticated'

export const MOCK_USER: SessionUser = {
  id: 'usr-00000001-0000-0000-0000-000000000001',
  fullName: 'Carlos Alberto Mendoza',
  email: 'carlos.mendoza@ficcion.test',
  role: 'Administrador Comercial',
  initials: 'CM',
}

export const MOCK_TENANTS: Tenant[] = [
  {
    id: 'tnt-andina-001',
    name: 'Andina Importaciones S.A.',
    tier: 'Plan Pyme',
  },
  {
    id: 'tnt-pacifico-002',
    name: 'Distribuidora del Pacífico Cía. Ltda.',
    tier: 'Plan Corporativo',
  },
  {
    id: 'tnt-austro-003',
    name: 'Industrias del Austro Ecuatoriano',
    tier: 'Plan Emprendedor',
  },
]

let isSessionActive = true
let inMemoryActiveTenantId: string = MOCK_TENANTS[0].id

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

// SOLID: SRP — IMPLEMENTA EL REPOSITORIO DE SESIÓN CON ALMACENAMIENTO LOCAL SEGURO Y DATOS SIMULADOS.
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

  async listTenants(): Promise<Tenant[]> {
    return [...MOCK_TENANTS]
  }

  async getActiveTenantId(): Promise<string | null> {
    const stored = getSafeLocalStorageItem(STORAGE_KEY_TENANT)
    if (stored && MOCK_TENANTS.some((t) => t.id === stored)) {
      return stored
    }
    return inMemoryActiveTenantId
  }

  async setActiveTenant(id: string): Promise<void> {
    const valid = MOCK_TENANTS.some((t) => t.id === id)
    if (!valid) {
      throw new Error(`El tenant con ID "${id}" no existe.`)
    }
    inMemoryActiveTenantId = id
    setSafeLocalStorageItem(STORAGE_KEY_TENANT, id)
  }

  async signIn(_email?: string): Promise<SessionUser> {
    isSessionActive = true
    setSafeLocalStorageItem(STORAGE_KEY_AUTH, 'true')
    return MOCK_USER
  }

  async signOut(): Promise<void> {
    isSessionActive = false
    setSafeLocalStorageItem(STORAGE_KEY_AUTH, 'false')
    removeSafeLocalStorageItem(STORAGE_KEY_TENANT)
    inMemoryActiveTenantId = MOCK_TENANTS[0].id
  }
}

/** Permite reiniciar el estado del mock en pruebas */
export function resetSessionMockStore(): void {
  isSessionActive = true
  inMemoryActiveTenantId = MOCK_TENANTS[0].id
  removeSafeLocalStorageItem(STORAGE_KEY_AUTH)
  removeSafeLocalStorageItem(STORAGE_KEY_TENANT)
}
