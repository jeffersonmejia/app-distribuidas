// SOLID: ISP - DEFINE EL CONTRATO Y ERRORES DEL REPOSITORIO DE MARKETING.

import type {
  Campaign,
  CampaignFilters,
  CampaignInput,
  CampaignPage,
  CampaignStatus,
  ContactPage,
  SendResult,
} from '../types/marketing'

export type MarketingErrorKind =
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'service_unavailable'
  | 'unknown'

export class MarketingApiError extends Error {
  readonly kind: MarketingErrorKind
  readonly code?: string

  constructor(message: string, kind: MarketingErrorKind, code?: string) {
    super(message)
    this.name = 'MarketingApiError'
    this.kind = kind
    this.code = code
  }
}

export interface MarketingRepository {
  listCampaigns(filters?: CampaignFilters, page?: number): Promise<CampaignPage>
  getCampaign(id: string): Promise<Campaign>
  createCampaign(input: CampaignInput): Promise<Campaign>
  updateStatus(id: string, status: CampaignStatus): Promise<Campaign>
  listContacts(campaignId: string, page?: number): Promise<ContactPage>
  setConsent(customerId: string): Promise<void>
  registerUnsubscribe(customerId: string): Promise<void>
  sendManual(campaignId: string, templateId: string): Promise<SendResult>
}
