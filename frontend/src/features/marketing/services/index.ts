// SOLID: OCP - DEFINE LA FABRICA DEL REPOSITORIO DE MARKETING SEGUN LA FUENTE DE DATOS.

import type { MarketingRepository } from './marketingRepository'
import type {
  Campaign,
  CampaignPage,
  ContactPage,
  SendResult,
} from '../types/marketing'
import { MarketingMockRepository } from './marketingMock'
import { MarketingApiError } from './marketingRepository'

export * from './marketingRepository'
export * from './marketingMock'

class UnavailableMarketingApiRepository implements MarketingRepository {
  async listCampaigns(): Promise<CampaignPage> {
    throw new MarketingApiError('Servicio de marketing no disponible todavía.', 'service_unavailable')
  }

  async getCampaign(): Promise<Campaign> {
    throw new MarketingApiError('Servicio de marketing no disponible todavía.', 'service_unavailable')
  }

  async createCampaign(): Promise<Campaign> {
    throw new MarketingApiError('Servicio de marketing no disponible todavía.', 'service_unavailable')
  }

  async updateStatus(): Promise<Campaign> {
    throw new MarketingApiError('Servicio de marketing no disponible todavía.', 'service_unavailable')
  }

  async listContacts(): Promise<ContactPage> {
    throw new MarketingApiError('Servicio de marketing no disponible todavía.', 'service_unavailable')
  }

  async setConsent(): Promise<void> {
    throw new MarketingApiError('Servicio de marketing no disponible todavía.', 'service_unavailable')
  }

  async registerUnsubscribe(): Promise<void> {
    throw new MarketingApiError('Servicio de marketing no disponible todavía.', 'service_unavailable')
  }

  async sendManual(): Promise<SendResult> {
    throw new MarketingApiError('Servicio de marketing no disponible todavía.', 'service_unavailable')
  }
}

let repositoryInstance: MarketingRepository | null = null

export function getMarketingRepository(): MarketingRepository {
  if (repositoryInstance) return repositoryInstance

  const dataSource = (import.meta.env.VITE_DATA_SOURCE || 'mock').toLowerCase().trim()
  repositoryInstance =
    dataSource === 'api' ? new UnavailableMarketingApiRepository() : new MarketingMockRepository()
  return repositoryInstance
}

export function setMarketingRepositoryForTesting(repo: MarketingRepository | null): void {
  repositoryInstance = repo
}
