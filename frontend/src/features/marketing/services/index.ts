// SOLID: OCP - DEFINE LA FABRICA DEL REPOSITORIO DE MARKETING SEGUN LA FUENTE DE DATOS.

import type { MarketingRepository } from './marketingRepository'
import { MarketingMockRepository } from './marketingMock'
import { MarketingApiRepository } from './marketingApi'

export * from './marketingRepository'
export * from './marketingMock'

let repositoryInstance: MarketingRepository | null = null

export function getMarketingRepository(): MarketingRepository {
  if (repositoryInstance) return repositoryInstance

  const dataSource = (import.meta.env.VITE_DATA_SOURCE || 'mock').toLowerCase().trim()
  repositoryInstance =
    dataSource === 'api' ? new MarketingApiRepository() : new MarketingMockRepository()
  return repositoryInstance
}

export function setMarketingRepositoryForTesting(repo: MarketingRepository | null): void {
  repositoryInstance = repo
}
