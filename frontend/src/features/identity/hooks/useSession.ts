// SOLID: SRP — HOOK PARA CONSUMIR EL CONTEXTO DE SESIÓN DE FORMA ACCESIBLE Y SEGURA.

import { useContext } from 'react'
import { SessionContext, type SessionContextValue } from '../context/SessionContext'

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession debe utilizarse dentro de un SessionProvider')
  }
  return context
}
