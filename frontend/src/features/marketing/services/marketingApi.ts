// SOLID: SRP — IMPLEMENTA EL ADAPTADOR HTTP DE CAMPAÑAS, CONTACTOS Y CONSENTIMIENTO.

import { getApiConfig } from '../../crm/config/apiConfig'
import { MarketingApiError, type MarketingRepository } from './marketingRepository'
import type { Campaign, CampaignFilters, CampaignInput, CampaignPage, CampaignStatus, ContactPage, SendResult } from '../types/marketing'

const BASE = '/api/v1/marketing'

//SOLID: SRP — CONSTRUYE HEADERS DE SESIÓN Y SELECTOR TENANT.
function headers(): Record<string, string> {
  const config = getApiConfig()
  return {
    'Content-Type': 'application/json',
    ...(config.accessToken ? { Authorization: `Bearer ${config.accessToken}` } : {}),
    ...(config.tenantId ? { 'X-Tenant-ID': config.tenantId } : {}),
  }
}

//SOLID: SRP — TRADUCE ERRORES HTTP A ERRORES PÚBLICOS SIN EXPONER MENSAJES INTERNOS.
async function error(response: Response): Promise<MarketingApiError> {
  let code: string | undefined
  try { code = (await response.json() as { code?: string }).code } catch { /* respuesta vacía */ }
  if (response.status === 404) return new MarketingApiError('No se encontró el recurso de Marketing.', 'not_found', code)
  if (response.status === 409) return new MarketingApiError('La operación entra en conflicto con el estado actual.', 'conflict', code)
  if (response.status === 400) return new MarketingApiError('Revisa los datos ingresados.', 'validation', code)
  if (response.status === 401 || response.status === 403) return new MarketingApiError('No tienes una sesión o permiso válido.', 'unknown', code)
  return new MarketingApiError('No se pudo completar la operación de Marketing.', 'unknown', code)
}

//SOLID: SRP — EJECUTA REQUESTS REST Y MANEJA FALLAS DE RED.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getApiConfig()
  let response: Response
  try { response = await fetch(`${config.baseUrl}${path}`, { ...init, headers: { ...headers(), ...init?.headers } }) }
  catch { throw new MarketingApiError('No se pudo conectar con Marketing.', 'service_unavailable') }
  if (!response.ok) throw await error(response)
  if (response.status === 204) return undefined as T
  return await response.json() as T
}

//SOLID: SRP — IMPLEMENTA LA API REST PÚBLICA DEL MÓDULO DE MARKETING.
export class MarketingApiRepository implements MarketingRepository {
  //SOLID: SRP — CONSULTA CAMPAÑAS CON PAGINACIÓN Y FILTRO DE ESTADO EN SERVIDOR.
  async listCampaigns(filters: CampaignFilters = {}, page = 0): Promise<CampaignPage> {
    const query = new URLSearchParams({ page: String(page), size: '5' })
    if (filters.status) query.set('status', filters.status)
    return request(`${BASE}/campaigns?${query}`)
  }
  //SOLID: SRP — OBTIENE UNA CAMPAÑA POR IDENTIDAD.
  async getCampaign(id: string): Promise<Campaign> { return request(`${BASE}/campaigns/${encodeURIComponent(id)}`) }
  //SOLID: SRP — CREA UNA CAMPAÑA CON EL DTO BACKEND.
  async createCampaign(input: CampaignInput): Promise<Campaign> {
    return request(`${BASE}/campaigns`, { method: 'POST', body: JSON.stringify(input) })
  }
  //SOLID: SRP — CAMBIA EL ESTADO MEDIANTE LA TRANSICIÓN VALIDADA EN BACKEND.
  async updateStatus(id: string, status: CampaignStatus): Promise<Campaign> {
    return request(`${BASE}/campaigns/${encodeURIComponent(id)}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) })
  }
  //SOLID: SRP — CONSULTA CONTACTOS DE UNA CAMPAÑA PAGINADOS EN SERVIDOR.
  async listContacts(campaignId: string, page = 0): Promise<ContactPage> {
    const query = new URLSearchParams({ page: String(page), size: '5' })
    return request(`${BASE}/campaigns/${encodeURIComponent(campaignId)}/contacts?${query}`)
  }
  //SOLID: SRP — REGISTRA CONSENTIMIENTO MEDIANTE LA API DE MARKETING.
  async setConsent(customerId: string): Promise<void> {
    await request(`${BASE}/contacts/${encodeURIComponent(customerId)}/consent`, { method: 'PUT' })
  }
  //SOLID: SRP — REGISTRA LA BAJA SOLICITADA POR EL CONTACTO.
  async registerUnsubscribe(customerId: string): Promise<void> {
    await request(`${BASE}/contacts/${encodeURIComponent(customerId)}/unsubscribe`, { method: 'PUT' })
  }
  //SOLID: SRP — DISPARA ENVÍO MANUAL SOLO CON LA PLANTILLA ELEGIDA POR EL USUARIO.
  async sendManual(campaignId: string, templateId: string): Promise<SendResult> {
    return request(`${BASE}/campaigns/${encodeURIComponent(campaignId)}/send`,
      { method: 'POST', body: JSON.stringify({ templateId }) })
  }
}
