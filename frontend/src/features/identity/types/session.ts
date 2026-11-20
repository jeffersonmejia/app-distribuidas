// SOLID: ISP — DEFINE LOS MODELOS DE DATOS DE SESIÓN Y MULTITENANCY ASOCIADOS AL USUARIO.

export interface Tenant {
  id: string
  name: string
  tier?: string
}

export interface SessionUser {
  id: string
  fullName: string
  email: string
  role: string
  initials: string
  tenantId: string
  tenantName: string
  tenant?: Tenant
}
