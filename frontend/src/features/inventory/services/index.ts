// SOLID: OCP — FACTORY PARA OBTENER LA INSTANCIA DE REPOSITORIO DE INVENTARIO SEGÚN LA FUENTE DE DATOS.
//
// Contratos pendientes de aprobación por el backend:
//   • INV-003: endpoints de creación, listado, detalle y consumo de stock de productos.
// Mientras no exista backend HTTP, VITE_DATA_SOURCE=api devuelve UnavailableInventoryApiRepository.
// Ver también: frontend/.env.example y features/pos/services/posMock.ts (interacción createSale ↔ stock).

import type { InventoryRepository } from './inventoryRepository'
import type { Product, ProductPage } from '../types/product'
import { InventoryMockRepository } from './inventoryMock'
import { InventoryApiError } from './inventoryRepository'

export * from './inventoryRepository'
export * from './inventoryMock'

/**
 * Repositorio de fallback cuando VITE_DATA_SOURCE=api pero no existe backend HTTP de inventario aún.
 * Se conectará una vez que los contratos y endpoints sean aprobados por el backend.
 */
class UnavailableInventoryApiRepository implements InventoryRepository {
  async list(): Promise<ProductPage> {
    throw new InventoryApiError('Servicio de inventario en backend no disponible todavía.', 'service_unavailable')
  }

  async create(): Promise<Product> {
    throw new InventoryApiError('Servicio de inventario en backend no disponible todavía.', 'service_unavailable')
  }
}

let repositoryInstance: InventoryRepository | null = null

export function getInventoryRepository(): InventoryRepository {
  if (repositoryInstance) return repositoryInstance

  const dataSource = (import.meta.env.VITE_DATA_SOURCE || 'mock').toLowerCase().trim()

  const repo = dataSource === 'api'
    ? new UnavailableInventoryApiRepository()
    : new InventoryMockRepository()

  repositoryInstance = repo
  return repo
}

export function setInventoryRepositoryForTesting(repo: InventoryRepository | null): void {
  repositoryInstance = repo
}
