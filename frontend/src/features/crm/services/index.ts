// SOLID: OCP — SELECCIONA LA IMPLEMENTACIÓN DEL REPOSITORIO SEGÚN LA FUENTE DE DATOS CONFIGURADA.

import { getApiConfig } from '../config/apiConfig'
import { CustomerApiRepository } from './customerApi'
import { CustomerMockRepository } from './customerMock'
import type { CustomerRepository } from './customerRepository'

//SOLID: OCP — PERMITE INTERCAMBIAR IMPLEMENTACIONES SIN MODIFICAR EL CÓDIGO CONSUMIDOR.
export function getCustomerRepository(): CustomerRepository {
  const { dataSource } = getApiConfig()
  if (dataSource === 'api') {
    return new CustomerApiRepository()
  }
  return new CustomerMockRepository()
}

export type { CustomerRepository } from './customerRepository'
export { CustomerApiError } from './customerRepository'
