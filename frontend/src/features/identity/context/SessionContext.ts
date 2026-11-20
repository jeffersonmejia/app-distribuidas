import { createContext } from 'react'
import type { SessionUser, Tenant } from '../types/session'

export interface SessionContextValue {
  user: SessionUser | null
  tenant: Tenant | null
  isLoading: boolean
  signIn: (email?: string) => Promise<void>
  signOut: () => Promise<void>
}

export const SessionContext = createContext<SessionContextValue | null>(null)
