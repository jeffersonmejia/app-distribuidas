import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  SessionMockRepository,
  resetSessionMockStore,
  MOCK_USER,
  MOCK_TENANTS,
} from './sessionMock'

describe('SessionMockRepository', () => {
  let repo: SessionMockRepository

  beforeEach(() => {
    resetSessionMockStore()
    repo = new SessionMockRepository()
  })

  it('devuelve el usuario ficticio con correo @ficcion.test', async () => {
    const user = await repo.getCurrentUser()
    expect(user).not.toBeNull()
    expect(user?.fullName).toBe('Carlos Alberto Mendoza')
    expect(user?.email).toBe('carlos.mendoza@ficcion.test')
    expect(user?.initials).toBe('CM')
  })

  it('lista los 3 tenants ficticios', async () => {
    const tenants = await repo.listTenants()
    expect(tenants).toHaveLength(3)
    expect(tenants[0].name).toBe('Andina Importaciones S.A.')
    expect(tenants[1].name).toBe('Distribuidora del Pacífico Cía. Ltda.')
    expect(tenants[2].name).toBe('Industrias del Austro Ecuatoriano')
  })

  it('devuelve el tenant activo por defecto y permite cambiarlo', async () => {
    const defaultId = await repo.getActiveTenantId()
    expect(defaultId).toBe(MOCK_TENANTS[0].id)

    await repo.setActiveTenant(MOCK_TENANTS[1].id)
    const newId = await repo.getActiveTenantId()
    expect(newId).toBe(MOCK_TENANTS[1].id)
  })

  it('falla si se intenta establecer un tenant inexistente', async () => {
    await expect(repo.setActiveTenant('tenant-invalido')).rejects.toThrow(
      /no existe/i,
    )
  })

  it('cierra la sesión y limpia el tenant activo', async () => {
    await repo.signOut()
    const user = await repo.getCurrentUser()
    expect(user).toBeNull()
  })

  it('opera en memoria si localStorage lanza un error de acceso', async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    const activeId = await repo.getActiveTenantId()
    expect(activeId).toBe(MOCK_TENANTS[0].id)

    await repo.setActiveTenant(MOCK_TENANTS[2].id)
    const changedId = await repo.getActiveTenantId()
    expect(changedId).toBe(MOCK_TENANTS[2].id)

    getItemSpy.mockRestore()
    setItemSpy.mockRestore()
  })
})
