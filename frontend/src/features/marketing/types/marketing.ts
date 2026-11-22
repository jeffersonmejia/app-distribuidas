// SOLID: SRP - DEFINE LOS TIPOS Y CONTRATOS DEL MODULO DE MARKETING SEGUN EL BACKEND.

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'FINISHED' | 'CANCELLED'

export type ContactConsent = 'CONSENTED' | 'UNSUBSCRIBED' | 'NONE'

export interface Campaign {
  id: string
  name: string
  description: string | null
  startDate: string | null
  endDate: string | null
  status: CampaignStatus
  createdAt: string
  updatedAt: string
}

export interface CampaignInput {
  name: string
  description?: string | null
  startDate?: string | null
  endDate?: string | null
}

export interface CampaignContact {
  customerId: string
  fullName: string
  email: string | null
  consent: ContactConsent
}

export interface SendResult {
  sent: number
  failed: number
  remainingToday: number
}

export interface CampaignFilters {
  status?: CampaignStatus | ''
}

export interface CampaignPage {
  items: Campaign[]
  page: number
  size: number
  hasNext: boolean
}

export interface ContactPage {
  items: CampaignContact[]
  page: number
  size: number
  hasNext: boolean
}
