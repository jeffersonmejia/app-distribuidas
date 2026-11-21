// SOLID: SRP - IMPLEMENTA UN REPOSITORIO SIMULADO DE MARKETING AISLADO POR TENANT.

import type {
  Campaign,
  CampaignFilters,
  CampaignInput,
  CampaignPage,
  CampaignStatus,
  CampaignContact,
  ContactConsent,
  ContactPage,
  SendResult,
} from '../types/marketing'
import { MarketingApiError, type MarketingRepository } from './marketingRepository'
import { MOCK_USER } from '../../identity/services/sessionMock'

const DEFAULT_TENANT_ID = MOCK_USER.tenantId
const PAGE_SIZE = 5
const LATENCY_MS = 300
const DAILY_SEND_LIMIT = 20

interface CrmContactSeed {
  customerId: string
  fullName: string
  email: string | null
  active: boolean
}

const CRM_CONTACTS_BY_TENANT: Record<string, CrmContactSeed[]> = {
  'tnt-andina-001': [
    { customerId: 'mock-andina-00000001', fullName: 'Carlos Alberto Mendoza', email: 'carlos.mendoza@ficcion.test', active: true },
    { customerId: 'mock-andina-00000002', fullName: 'Lucía del Carmen Viteri', email: 'lucia.viteri@ficcion.test', active: true },
    { customerId: 'mock-andina-00000003', fullName: 'Esteban Patricio Paredes', email: 'esteban.paredes@ficcion.test', active: false },
    { customerId: 'mock-andina-00000004', fullName: 'Valeria Sofía Espinoza', email: 'valeria.espinoza@ficcion.test', active: true },
    { customerId: 'mock-andina-00000005', fullName: 'Gabriel Alejandro Salazar', email: 'gabriel.salazar@ficcion.test', active: true },
    { customerId: 'mock-andina-00000006', fullName: 'Camila Mercedes Benítez', email: null, active: true },
    { customerId: 'mock-andina-00000007', fullName: 'Mateo Daniel Cevallos', email: 'mateo.cevallos@ficcion.test', active: false },
  ],
  'tnt-pacifico-002': [
    { customerId: 'mock-pacifico-00000001', fullName: 'Andrés Felipe Morales', email: 'andres.morales@ficcion.test', active: true },
    { customerId: 'mock-pacifico-00000002', fullName: 'Daniela Rocío Zambrano', email: 'daniela.zambrano@ficcion.test', active: true },
  ],
  'tnt-austro-003': [
    { customerId: 'mock-austro-00000001', fullName: 'Joaquín Ignacio Cordero', email: 'joaquin.cordero@ficcion.test', active: true },
    { customerId: 'mock-austro-00000002', fullName: 'Beatriz Elena Ordóñez', email: 'beatriz.ordonez@ficcion.test', active: false },
  ],
}

interface DeliveryRecord {
  campaignId: string
  templateId: string
  customerId: string
  day: string
}

interface TenantStore {
  campaigns: Campaign[]
  campaignMembers: Record<string, string[]>
  consents: Record<string, ContactConsent>
  deliveries: DeliveryRecord[]
}

function delay(ms = LATENCY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function nowIso(): string {
  return new Date().toISOString()
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function normalizeText(value?: string | null): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function canMoveTo(current: CampaignStatus, next: CampaignStatus): boolean {
  const order: CampaignStatus[] = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'FINISHED', 'CANCELLED']
  if (current === 'FINISHED' || current === 'CANCELLED') return false
  if (next === 'CANCELLED') return true
  return order.indexOf(next) === order.indexOf(current) + 1
}

function buildSeed(): Record<string, TenantStore> {
  const andinaMembers = (ids: string[]) => ids
  return {
    'tnt-andina-001': {
      campaigns: [
        { id: 'cmp-andina-001', name: 'Lanzamiento catálogo Q4', description: 'Promoción de nuevos productos para clientes activos.', startDate: '2026-11-01', endDate: '2026-11-30', status: 'ACTIVE', createdAt: '2026-10-20T08:00:00.000Z', updatedAt: '2026-11-01T08:00:00.000Z' },
        { id: 'cmp-andina-002', name: 'Recordatorio de cartera', description: 'Seguimiento preventivo a cuentas con saldo.', startDate: '2026-11-10', endDate: '2026-12-10', status: 'SCHEDULED', createdAt: '2026-11-02T09:00:00.000Z', updatedAt: '2026-11-05T09:00:00.000Z' },
        { id: 'cmp-andina-003', name: 'Encuesta de satisfacción', description: 'Medición de experiencia posterior a compra.', startDate: '2026-10-01', endDate: '2026-10-20', status: 'FINISHED', createdAt: '2026-09-20T10:00:00.000Z', updatedAt: '2026-10-21T10:00:00.000Z' },
        { id: 'cmp-andina-004', name: 'Reactivación mayorista', description: 'Ofertas para cuentas con baja actividad.', startDate: '2026-12-01', endDate: '2026-12-31', status: 'DRAFT', createdAt: '2026-11-12T11:00:00.000Z', updatedAt: '2026-11-12T11:00:00.000Z' },
        { id: 'cmp-andina-005', name: 'Invitación evento anual', description: 'Convocatoria a clientes preferentes.', startDate: '2026-09-01', endDate: '2026-09-15', status: 'CANCELLED', createdAt: '2026-08-20T12:00:00.000Z', updatedAt: '2026-08-28T12:00:00.000Z' },
        { id: 'cmp-andina-006', name: 'Beneficios por fidelidad', description: 'Comunicación de beneficios acumulados.', startDate: '2026-11-15', endDate: '2026-12-15', status: 'DRAFT', createdAt: '2026-11-14T13:00:00.000Z', updatedAt: '2026-11-14T13:00:00.000Z' },
      ],
      campaignMembers: {
        'cmp-andina-001': andinaMembers(['mock-andina-00000001', 'mock-andina-00000002', 'mock-andina-00000004', 'mock-andina-00000005', 'mock-andina-00000006']),
        'cmp-andina-002': andinaMembers(['mock-andina-00000001', 'mock-andina-00000004', 'mock-andina-00000005']),
        'cmp-andina-003': andinaMembers(['mock-andina-00000001', 'mock-andina-00000002', 'mock-andina-00000004']),
        'cmp-andina-004': andinaMembers(['mock-andina-00000002', 'mock-andina-00000005', 'mock-andina-00000006']),
        'cmp-andina-005': andinaMembers(['mock-andina-00000001', 'mock-andina-00000002']),
        'cmp-andina-006': andinaMembers(['mock-andina-00000001', 'mock-andina-00000004', 'mock-andina-00000005', 'mock-andina-00000006']),
      },
      consents: {
        'mock-andina-00000001': 'CONSENTED',
        'mock-andina-00000002': 'UNSUBSCRIBED',
        'mock-andina-00000004': 'CONSENTED',
        'mock-andina-00000005': 'NONE',
      },
      deliveries: [],
    },
    'tnt-pacifico-002': {
      campaigns: [
        { id: 'cmp-pacifico-001', name: 'Promoción costera', description: 'Descuentos regionales para clientes activos.', startDate: '2026-11-05', endDate: '2026-11-25', status: 'ACTIVE', createdAt: '2026-10-28T08:00:00.000Z', updatedAt: '2026-11-05T08:00:00.000Z' },
      ],
      campaignMembers: {
        'cmp-pacifico-001': ['mock-pacifico-00000001', 'mock-pacifico-00000002'],
      },
      consents: {
        'mock-pacifico-00000001': 'CONSENTED',
      },
      deliveries: [],
    },
  }
}

let stores = new Map<string, TenantStore>()
let nextCampaignId = 1000

function initStores(): void {
  stores = new Map<string, TenantStore>()
  const seed = buildSeed()
  for (const [tenantId, data] of Object.entries(seed)) {
    stores.set(tenantId, {
      campaigns: data.campaigns.map((c) => ({ ...c })),
      campaignMembers: Object.fromEntries(
        Object.entries(data.campaignMembers).map(([k, v]) => [k, [...v]])
      ),
      consents: { ...data.consents },
      deliveries: data.deliveries.map((d) => ({ ...d })),
    })
  }
  nextCampaignId = 1000
}

initStores()

function paginate<T>(items: T[], page: number): { items: T[]; hasNext: boolean } {
  const start = page * PAGE_SIZE
  const pageItems = items.slice(start, start + PAGE_SIZE)
  return { items: pageItems, hasNext: start + PAGE_SIZE < items.length }
}

function validatePage(page: number): void {
  if (!Number.isInteger(page) || page < 0) {
    throw new MarketingApiError('La página solicitada no es válida.', 'validation', 'INVALID_PAGE')
  }
}

// SOLID: SRP - ADMINISTRA CAMPAÑAS, CONSENTIMIENTOS Y ENVIOS EN MEMORIA POR TENANT.
export class MarketingMockRepository implements MarketingRepository {
  private explicitTenantId?: string

  constructor(explicitTenantId?: string) {
    this.explicitTenantId = explicitTenantId
  }

  private getTenantId(): string {
    return this.explicitTenantId ?? DEFAULT_TENANT_ID
  }

  private getStore(): TenantStore {
    const tenantId = this.getTenantId()
    if (!stores.has(tenantId)) {
      stores.set(tenantId, { campaigns: [], campaignMembers: {}, consents: {}, deliveries: [] })
    }
    return stores.get(tenantId)!
  }

  private getActiveCrmContacts(): CrmContactSeed[] {
    return (CRM_CONTACTS_BY_TENANT[this.getTenantId()] ?? []).filter((c) => c.active)
  }

  async listCampaigns(filters: CampaignFilters = {}, page = 0): Promise<CampaignPage> {
    await delay()
    validatePage(page)
    let items = [...this.getStore().campaigns]
    if (filters.status) {
      items = items.filter((c) => c.status === filters.status)
    }
    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name))
    const { items: pageItems, hasNext } = paginate(items, page)
    return { items: pageItems.map((c) => ({ ...c })), page, size: PAGE_SIZE, hasNext }
  }

  async getCampaign(id: string): Promise<Campaign> {
    await delay()
    const campaign = this.getStore().campaigns.find((c) => c.id === id)
    if (!campaign) {
      throw new MarketingApiError('Campaña no encontrada.', 'not_found', 'CAMPAIGN_NOT_FOUND')
    }
    return { ...campaign }
  }

  async createCampaign(input: CampaignInput): Promise<Campaign> {
    await delay()
    const name = normalizeText(input.name)
    const description = normalizeText(input.description ?? null)
    const startDate = normalizeText(input.startDate ?? null)
    const endDate = normalizeText(input.endDate ?? null)

    if (!name) {
      throw new MarketingApiError('El nombre de la campaña es obligatorio.', 'validation', 'INVALID_CAMPAIGN_DATA')
    }
    if ((startDate && !isValidDateString(startDate)) || (endDate && !isValidDateString(endDate))) {
      throw new MarketingApiError('Las fechas de la campaña no son válidas.', 'validation', 'INVALID_CAMPAIGN_DATA')
    }
    if (startDate && endDate && endDate < startDate) {
      throw new MarketingApiError('La fecha de fin no puede ser anterior al inicio.', 'validation', 'INVALID_CAMPAIGN_DATA')
    }

    nextCampaignId += 1
    const ts = nowIso()
    const campaign: Campaign = {
      id: `cmp-${this.getTenantId().slice(-3)}-${nextCampaignId}`,
      name,
      description,
      startDate,
      endDate,
      status: 'DRAFT',
      createdAt: ts,
      updatedAt: ts,
    }
    const store = this.getStore()
    store.campaigns = [campaign, ...store.campaigns]
    store.campaignMembers[campaign.id] = []
    return { ...campaign }
  }

  async updateStatus(id: string, status: CampaignStatus): Promise<Campaign> {
    await delay()
    const store = this.getStore()
    const index = store.campaigns.findIndex((c) => c.id === id)
    if (index < 0) {
      throw new MarketingApiError('Campaña no encontrada.', 'not_found', 'CAMPAIGN_NOT_FOUND')
    }
    const current = store.campaigns[index]
    if (!canMoveTo(current.status, status)) {
      throw new MarketingApiError('La transición de estado no es válida.', 'conflict', 'INVALID_CAMPAIGN_TRANSITION')
    }
    const updated: Campaign = { ...current, status, updatedAt: nowIso() }
    store.campaigns[index] = updated
    return { ...updated }
  }

  async listContacts(campaignId: string, page = 0): Promise<ContactPage> {
    await delay()
    validatePage(page)
    const store = this.getStore()
    if (!store.campaigns.some((c) => c.id === campaignId)) {
      throw new MarketingApiError('Campaña no encontrada.', 'not_found', 'CAMPAIGN_NOT_FOUND')
    }
    const memberIds = new Set(store.campaignMembers[campaignId] ?? [])
    const activeCrm = this.getActiveCrmContacts()
    const items: CampaignContact[] = activeCrm
      .filter((c) => memberIds.has(c.customerId))
      .map((c) => ({
        customerId: c.customerId,
        fullName: c.fullName,
        email: c.email,
        consent: (store.consents[c.customerId] ?? 'NONE') as ContactConsent,
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))

    const { items: pageItems, hasNext } = paginate(items, page)
    return { items: pageItems.map((c) => ({ ...c })), page, size: PAGE_SIZE, hasNext }
  }

  async setConsent(customerId: string): Promise<void> {
    await delay()
    const store = this.getStore()
    const crm = this.getActiveCrmContacts().find((c) => c.customerId === customerId)
    if (!crm) {
      throw new MarketingApiError('Contacto no encontrado.', 'not_found', 'CONTACT_NOT_FOUND')
    }
    if (store.consents[customerId] === 'UNSUBSCRIBED') {
      throw new MarketingApiError('El contacto se encuentra dado de baja.', 'conflict', 'CONTACT_UNSUBSCRIBED')
    }
    store.consents[customerId] = 'CONSENTED'
  }

  async registerUnsubscribe(customerId: string): Promise<void> {
    await delay()
    const store = this.getStore()
    const known = (CRM_CONTACTS_BY_TENANT[this.getTenantId()] ?? []).some((c) => c.customerId === customerId)
    if (!known) {
      throw new MarketingApiError('Contacto no encontrado.', 'not_found', 'CONTACT_NOT_FOUND')
    }
    store.consents[customerId] = 'UNSUBSCRIBED'
  }

  async sendManual(campaignId: string, templateId: string): Promise<SendResult> {
    await delay()
    const normalizedTemplate = normalizeText(templateId)
    if (!normalizedTemplate) {
      throw new MarketingApiError('La plantilla es obligatoria.', 'validation', 'INVALID_REQUEST')
    }

    const store = this.getStore()
    const campaign = store.campaigns.find((c) => c.id === campaignId)
    if (!campaign) {
      throw new MarketingApiError('Campaña no encontrada.', 'not_found', 'CAMPAIGN_NOT_FOUND')
    }
    if (campaign.status !== 'ACTIVE') {
      throw new MarketingApiError('La campaña no está activa.', 'conflict', 'CAMPAIGN_NOT_ACTIVE')
    }

    const day = todayUtc()
    const deliveredToday = store.deliveries.filter((d) => d.day === day).length
    const remaining = DAILY_SEND_LIMIT - deliveredToday
    if (remaining <= 0) {
      throw new MarketingApiError('Se alcanzó el límite diario de envíos.', 'conflict', 'DAILY_LIMIT_REACHED')
    }

    const memberIds = new Set(store.campaignMembers[campaignId] ?? [])
    const activeCrm = this.getActiveCrmContacts()
    const alreadyDelivered = new Set(
      store.deliveries
        .filter((d) => d.campaignId === campaignId && d.templateId === normalizedTemplate)
        .map((d) => d.customerId)
    )

    const eligible = activeCrm.filter(
      (c) =>
        memberIds.has(c.customerId) &&
        c.email &&
        store.consents[c.customerId] === 'CONSENTED' &&
        !alreadyDelivered.has(c.customerId)
    )

    let sent = 0
    let failed = 0
    for (const contact of eligible) {
      if (sent >= remaining) break
      store.deliveries.push({
        campaignId,
        templateId: normalizedTemplate,
        customerId: contact.customerId,
        day,
      })
      sent += 1
    }

    return { sent, failed, remainingToday: remaining - sent }
  }
}

export function resetMarketingMockStore(): void {
  initStores()
}
