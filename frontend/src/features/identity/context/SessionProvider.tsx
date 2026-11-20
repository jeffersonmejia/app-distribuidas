// SOLID: SRP — PROVEE EL ESTADO GLOBAL DE SESIÓN Y TENANTS A LA APLICACIÓN.

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { SessionContext, type SessionContextValue } from './SessionContext'
import { getSessionRepository, type SessionRepository } from '../services'
import type { SessionUser, Tenant } from '../types/session'

export interface SessionProviderProps {
  children: ReactNode
  repository?: SessionRepository
}

export function SessionProvider({ children, repository }: SessionProviderProps) {
  const repo = repository ?? getSessionRepository()

  const [user, setUser] = useState<SessionUser | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [activeTenant, setActiveTenantState] = useState<Tenant | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadSession = useCallback(async () => {
    setIsLoading(true)
    try {
      const currentUser = await repo.getCurrentUser()
      const tenantList = await repo.listTenants()
      const activeId = await repo.getActiveTenantId()
      const matchedActive = tenantList.find((t) => t.id === activeId) ?? tenantList[0] ?? null

      setUser(currentUser)
      setTenants(tenantList)
      setActiveTenantState(matchedActive)
    } catch {
      setUser(null)
      setTenants([])
      setActiveTenantState(null)
    } finally {
      setIsLoading(false)
    }
  }, [repo])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  const handleSetActiveTenant = useCallback(
    async (id: string) => {
      await repo.setActiveTenant(id)
      const matched = tenants.find((t) => t.id === id) ?? null
      setActiveTenantState(matched)
    },
    [repo, tenants],
  )

  const handleSignIn = useCallback(
    async (email?: string) => {
      if (repo.signIn) {
        const signedInUser = await repo.signIn(email ?? '')
        setUser(signedInUser)
      } else {
        const u = await repo.getCurrentUser()
        setUser(u)
      }
      const tenantList = await repo.listTenants()
      const activeId = await repo.getActiveTenantId()
      const matchedActive = tenantList.find((t) => t.id === activeId) ?? tenantList[0] ?? null
      setTenants(tenantList)
      setActiveTenantState(matchedActive)
    },
    [repo],
  )

  const handleSignOut = useCallback(async () => {
    await repo.signOut()
    setUser(null)
    setActiveTenantState(null)
  }, [repo])

  const value: SessionContextValue = {
    user,
    tenants,
    activeTenant,
    isLoading,
    setActiveTenant: handleSetActiveTenant,
    signIn: handleSignIn,
    signOut: handleSignOut,
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
