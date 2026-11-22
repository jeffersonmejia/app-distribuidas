// SOLID: OCP — FACTORY PARA OBTENER LA INSTANCIA DE REPOSITORIO DE INVENTARIO SEGÚN LA FUENTE DE DATOS.
//
import type { InventoryRepository } from './inventoryRepository'
import { InventoryMockRepository } from './inventoryMock'
import { InventoryApiRepository } from './inventoryApi'

export * from './inventoryRepository'
export * from './inventoryMock'

let repositoryInstance: InventoryRepository | null = null

export function getInventoryRepository(): InventoryRepository {
  if (repositoryInstance) return repositoryInstance

  const dataSource = (import.meta.env.VITE_DATA_SOURCE || 'mock').toLowerCase().trim()

  const repo = dataSource === 'api'
    ? new InventoryApiRepository()
    : new InventoryMockRepository()

  repositoryInstance = repo
  return repo
}

export function setInventoryRepositoryForTesting(repo: InventoryRepository | null): void {
  repositoryInstance = repo
}
