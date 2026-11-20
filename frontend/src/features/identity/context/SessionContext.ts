import { createContext } from 'react'
import type { SessionUser, Tenant } from '../types/session'

export interface SessionContextValue {
  user: SessionUser | null
  tenants: Tenant[]
  activeTenant: Tenant | null
  isLoading: boolean
  setActiveTenant: (id: string) => Promise<void>
  signIn: (email?: string) => Promise<void>
  signOut: () => Promise<void>
}

export const SessionContext = createContext<SessionContextValue | null>(null)
