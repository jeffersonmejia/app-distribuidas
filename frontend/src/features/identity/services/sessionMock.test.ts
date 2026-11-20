import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  SessionMockRepository,
  resetSessionMockStore,
  MOCK_USER,
  MOCK_TENANT,
} from './sessionMock'

describe('SessionMockRepository', () => {
  let repo: SessionMockRepository

  beforeEach(() => {
    resetSessionMockStore()
    repo = new SessionMockRepository()
  })

  it('devuelve el usuario ficticio con correo @ficcion.test y su organización asociada', async () => {
    const user = await repo.getCurrentUser()
    expect(user).not.toBeNull()
    expect(user?.fullName).toBe('Carlos Alberto Mendoza')
    expect(user?.email).toBe('carlos.mendoza@ficcion.test')
    expect(user?.initials).toBe('CM')
    expect(user?.tenantId).toBe(MOCK_TENANT.id)
    expect(user?.tenantName).toBe(MOCK_TENANT.name)
  })

  it('devuelve la organización actual asociada al usuario autenticado', async () => {
    const tenant = await repo.getCurrentTenant()
    expect(tenant).not.toBeNull()
    expect(tenant?.id).toBe(MOCK_TENANT.id)
    expect(tenant?.name).toBe('Andina Importaciones S.A.')
  })

  it('cierra la sesión del usuario', async () => {
    await repo.signOut()
    const user = await repo.getCurrentUser()
    expect(user).toBeNull()

    const tenant = await repo.getCurrentTenant()
    expect(tenant).toBeNull()
  })

  it('inicia sesión correctamente restableciendo el usuario', async () => {
    await repo.signOut()
    expect(await repo.getCurrentUser()).toBeNull()

    await repo.signIn('carlos.mendoza@ficcion.test')
    const user = await repo.getCurrentUser()
    expect(user).not.toBeNull()
    expect(user?.fullName).toBe('Carlos Alberto Mendoza')
  })

  it('opera en memoria si localStorage lanza un error de acceso', async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    const user = await repo.getCurrentUser()
    expect(user).not.toBeNull()

    getItemSpy.mockRestore()
    setItemSpy.mockRestore()
  })
})
