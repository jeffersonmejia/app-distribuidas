// SOLID: ISP — DEFINE LA INTERFAZ PARA EL MANEJO DE SESIÓN Y OBTENCIÓN DEL TENANT ASOCIADO AL USUARIO.

import type { SessionUser, Tenant } from '../types/session'

export interface SessionRepository {
  getCurrentUser(): Promise<SessionUser | null>
  getCurrentTenant(): Promise<Tenant | null>
  signIn?(email?: string): Promise<SessionUser>
  signOut(): Promise<void>
}
