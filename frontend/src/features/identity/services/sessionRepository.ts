// SOLID: ISP — DEFINE LA INTERFAZ PARA EL MANEJO DE SESIÓN Y MULTITENANT DEL SISTEMA.

import type { SessionUser, Tenant } from '../types/session'

export interface SessionRepository {
  getCurrentUser(): Promise<SessionUser | null>
  listTenants(): Promise<Tenant[]>
  getActiveTenantId(): Promise<string | null>
  setActiveTenant(id: string): Promise<void>
  signIn?(email: string): Promise<SessionUser>
  signOut(): Promise<void>
}
