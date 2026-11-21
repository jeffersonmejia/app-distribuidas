// SOLID: OCP - DEFINE LA FABRICA DEL REPOSITORIO CONTABLE SEGUN LA FUENTE DE DATOS.

import type { AccountingRepository } from './accountingRepository'
import type { AccountingSummary, JournalEntry, JournalEntryPage } from '../types/accounting'
import { AccountingApiError } from './accountingRepository'
import { AccountingMockRepository } from './accountingMock'

export * from './accountingRepository'
export * from './accountingMock'

class UnavailableAccountingApiRepository implements AccountingRepository {
  async listEntries(): Promise<JournalEntryPage> {
    throw new AccountingApiError('servicio contable no disponible todavía', 'service_unavailable')
  }

  async getEntry(): Promise<JournalEntry> {
    throw new AccountingApiError('servicio contable no disponible todavía', 'service_unavailable')
  }

  async getSummary(): Promise<AccountingSummary> {
    throw new AccountingApiError('servicio contable no disponible todavía', 'service_unavailable')
  }
}

let repositoryInstance: AccountingRepository | null = null

export function getAccountingRepository(): AccountingRepository {
  if (repositoryInstance) return repositoryInstance
  const dataSource = (import.meta.env.VITE_DATA_SOURCE || 'mock').toLowerCase().trim()
  repositoryInstance =
    dataSource === 'api' ? new UnavailableAccountingApiRepository() : new AccountingMockRepository()
  return repositoryInstance
}

export function setAccountingRepositoryForTesting(repo: AccountingRepository | null): void {
  repositoryInstance = repo
}
