// SOLID: SRP — PROVEE EL ESTADO GLOBAL DE SESIÓN Y TENANT DEL USUARIO A LA APLICACIÓN.

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
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadSession = useCallback(async () => {
    setIsLoading(true)
    try {
      const currentUser = await repo.getCurrentUser()
      const currentTenant = await repo.getCurrentTenant()

      setUser(currentUser)
      setTenant(currentTenant)
    } catch {
      setUser(null)
      setTenant(null)
    } finally {
      setIsLoading(false)
    }
  }, [repo])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  const handleSignIn = useCallback(
    async (email?: string) => {
      let signedInUser: SessionUser | null = null
      if (repo.signIn) {
        signedInUser = await repo.signIn(email ?? '')
        setUser(signedInUser)
      } else {
        signedInUser = await repo.getCurrentUser()
        setUser(signedInUser)
      }
      const currentTenant = await repo.getCurrentTenant()
      setTenant(currentTenant)
    },
    [repo],
  )

  const handleSignOut = useCallback(async () => {
    await repo.signOut()
    setUser(null)
    setTenant(null)
  }, [repo])

  const value: SessionContextValue = {
    user,
    tenant,
    isLoading,
    signIn: handleSignIn,
    signOut: handleSignOut,
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
