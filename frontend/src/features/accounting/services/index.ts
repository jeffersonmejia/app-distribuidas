// SOLID: OCP - DEFINE LA FABRICA DEL REPOSITORIO CONTABLE SEGUN LA FUENTE DE DATOS.

import type { AccountingRepository } from './accountingRepository'
import { AccountingMockRepository } from './accountingMock'
import { AccountingApiRepository } from './accountingApi'

export * from './accountingRepository'
export * from './accountingMock'

let repositoryInstance: AccountingRepository | null = null

export function getAccountingRepository(): AccountingRepository {
  if (repositoryInstance) return repositoryInstance
  const dataSource = (import.meta.env.VITE_DATA_SOURCE || 'mock').toLowerCase().trim()
  repositoryInstance =
    dataSource === 'api' ? new AccountingApiRepository() : new AccountingMockRepository()
  return repositoryInstance
}

export function setAccountingRepositoryForTesting(repo: AccountingRepository | null): void {
  repositoryInstance = repo
}
