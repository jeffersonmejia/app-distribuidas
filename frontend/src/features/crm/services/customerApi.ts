// SOLID: SRP — IMPLEMENTACIÓN DEL REPOSITORIO QUE CONSUME LA API REAL DE CLIENTES.

import { getApiConfig } from '../config/apiConfig'
import type {
  CustomerFilters,
  CustomerInput,
  CustomerPage,
  CustomerStatus,
  CustomerView,
} from '../types/customer'
import { CustomerApiError, type CustomerRepository } from './customerRepository'

//SOLID: SRP — CONSTRUYE LOS HEADERS DE AUTORIZACIÓN SIN EXPONER TOKENS EN LOGS NI ERRORES.
function buildHeaders(): Record<string, string> {
  const config = getApiConfig()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (config.accessToken) {
    headers['Authorization'] = `Bearer ${config.accessToken}`
  }
  if (config.tenantId) {
    headers['X-Tenant-ID'] = config.tenantId
  }
  return headers
}

//SOLID: SRP — MAPEA CÓDIGOS HTTP A ERRORES DE DOMINIO SIN REVELAR DETALLES INTERNOS.
async function mapError(response: Response): Promise<CustomerApiError> {
  if (response.status === 401) {
    return new CustomerApiError(
      'No tienes una sesión activa. Vuelve a iniciar sesión.',
      'unauthorized',
      401,
    )
  }
  if (response.status === 403) {
    return new CustomerApiError(
      'No tienes permiso para realizar esta acción.',
      'forbidden',
      403,
    )
  }
  if (response.status === 400) {
    return new CustomerApiError(
      'Los datos ingresados no son válidos.',
      'validation',
      400,
    )
  }
  if (response.status === 409) {
    // No revelar body ni datos del conflicto
    return new CustomerApiError(
      'Ya existe un cliente con esa cédula o correo.',
      'duplicate',
      409,
    )
  }
  return new CustomerApiError('Ocurrió un error inesperado. Inténtalo de nuevo.', 'unknown', response.status)
}

const BASE = '/api/v1/crm/customers'

//SOLID: SRP — APLICA EL ORIGEN CONFIGURADO DEL BACKEND A LAS RUTAS REST.
function apiUrl(path: string): string { return `${getApiConfig().baseUrl}${path}` }

//SOLID: SRP — IMPLEMENTA EL REPOSITORIO HACIENDO PETICIONES HTTP A LA API DEL BACKEND.
export class CustomerApiRepository implements CustomerRepository {
  async list(filters: CustomerFilters = {}, page = 0): Promise<CustomerPage> {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('size', '5')
    if (filters.search && filters.search.trim() !== '') {
      params.set('search', filters.search.trim())
    }
    if (filters.status) {
      params.set('status', filters.status)
    }

    const response = await fetch(apiUrl(`${BASE}?${params.toString()}`), {
      method: 'GET',
      headers: buildHeaders(),
    })

    if (!response.ok) {
      throw await mapError(response)
    }

    const data = await response.json() as CustomerPage
    return data
  }

  async create(input: CustomerInput): Promise<CustomerView> {
    const body = {
      fullName: input.fullName.trim(),
      cedula: input.cedula?.trim() || null,
      email: input.email?.trim().toLowerCase() || null,
      phone: input.phone?.trim() || null,
    }

    const response = await fetch(apiUrl(BASE), {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw await mapError(response)
    }

    return await response.json() as CustomerView
  }

  async update(id: string, input: CustomerInput): Promise<CustomerView> {
    const body = {
      fullName: input.fullName.trim(),
      cedula: input.cedula?.trim() || null,
      email: input.email?.trim().toLowerCase() || null,
      phone: input.phone?.trim() || null,
    }

    const response = await fetch(apiUrl(`${BASE}/${id}`), {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw await mapError(response)
    }

    return await response.json() as CustomerView
  }

  async archive(id: string): Promise<void> {
    const response = await fetch(apiUrl(`${BASE}/${id}`), {
      method: 'DELETE',
      headers: buildHeaders(),
    })

    if (!response.ok) {
      throw await mapError(response)
    }
  }

  async setStatus(id: string, status: CustomerStatus): Promise<CustomerView> {
    const response = await fetch(apiUrl(`${BASE}/${id}/status`), {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify({ status }),
    })

    if (!response.ok) {
      throw await mapError(response)
    }

    return await response.json() as CustomerView
  }
}
