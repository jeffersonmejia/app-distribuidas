// SOLID: ISP — DEFINE LOS MODELOS DE DATOS DE SESIÓN Y MULTITENANCY.

export interface SessionUser {
  id: string
  fullName: string
  email: string
  role: string
  initials: string
}

export interface Tenant {
  id: string
  name: string
  tier: string
}
