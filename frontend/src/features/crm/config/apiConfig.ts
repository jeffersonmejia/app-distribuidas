// SOLID: SRP — PUNTO ÚNICO DE LECTURA DE LA CONFIGURACIÓN DE ENTORNO PARA CRM.

export interface ApiConfig {
  dataSource: 'mock' | 'api'
  baseUrl: string
  /** Solo disponible en modo desarrollo y si está definido en .env.local */
  accessToken: string | null
  /** Solo disponible en modo desarrollo y si está definido en .env.local */
  tenantId: string | null
}

//SOLID: SRP — CONSOLIDA LA LECTURA DE VARIABLES DE ENTORNO EN UN SOLO LUGAR.
export function getApiConfig(): ApiConfig {
  const raw = import.meta.env['VITE_DATA_SOURCE']
  const dataSource: 'mock' | 'api' = raw === 'api' ? 'api' : 'mock'

  const baseUrl: string = import.meta.env['VITE_API_BASE_URL'] ?? ''

  // Token y tenant solo se leen en modo dev; en producción siempre null.
  let accessToken: string | null = null
  let tenantId: string | null = null

  if (import.meta.env.DEV) {
    const rawToken = import.meta.env['VITE_DEV_ACCESS_TOKEN']
    const rawTenant = import.meta.env['VITE_DEV_TENANT_ID']
    accessToken = typeof rawToken === 'string' && rawToken.trim() !== '' ? rawToken : null
    tenantId = typeof rawTenant === 'string' && rawTenant.trim() !== '' ? rawTenant : null
  }

  return { dataSource, baseUrl, accessToken, tenantId }
}
