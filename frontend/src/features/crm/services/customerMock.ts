// SOLID: SRP — IMPLEMENTACIÓN EN MEMORIA DEL REPOSITORIO DE CLIENTES PARA DESARROLLO Y PRUEBAS.

import type {
  CustomerFilters,
  CustomerInput,
  CustomerPage,
  CustomerStatus,
  CustomerView,
} from '../types/customer'
import { CustomerApiError, type CustomerRepository } from './customerRepository'

// Datos claramente ficticios — no representan personas reales.
const MOCK_SEED: CustomerView[] = [
  {
    id: 'mock-00000001-0000-0000-0000-000000000001',
    fullName: 'Cliente de Ejemplo 01',
    cedula: '1700000001',
    email: 'ejemplo01@ficcion.test',
    phone: '0991000001',
    status: 'ACTIVE',
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'mock-00000001-0000-0000-0000-000000000002',
    fullName: 'Cliente de Ejemplo 02',
    cedula: '1700000002',
    email: 'ejemplo02@ficcion.test',
    phone: '0991000002',
    status: 'ACTIVE',
    createdAt: '2026-01-11T10:00:00Z',
    updatedAt: '2026-01-11T10:00:00Z',
  },
  {
    id: 'mock-00000001-0000-0000-0000-000000000003',
    fullName: 'Cliente de Ejemplo 03',
    cedula: '1700000003',
    email: 'ejemplo03@ficcion.test',
    phone: '0991000003',
    status: 'INACTIVE',
    createdAt: '2026-01-12T10:00:00Z',
    updatedAt: '2026-01-15T08:00:00Z',
  },
  {
    id: 'mock-00000001-0000-0000-0000-000000000004',
    fullName: 'Cliente de Ejemplo 04',
    cedula: '1700000004',
    email: 'ejemplo04@ficcion.test',
    phone: null,
    status: 'ACTIVE',
    createdAt: '2026-01-13T10:00:00Z',
    updatedAt: '2026-01-13T10:00:00Z',
  },
  {
    id: 'mock-00000001-0000-0000-0000-000000000005',
    fullName: 'Cliente de Ejemplo 05',
    cedula: null,
    email: 'ejemplo05@ficcion.test',
    phone: '0991000005',
    status: 'ACTIVE',
    createdAt: '2026-01-14T10:00:00Z',
    updatedAt: '2026-01-14T10:00:00Z',
  },
  {
    id: 'mock-00000001-0000-0000-0000-000000000006',
    fullName: 'Cliente de Ejemplo 06',
    cedula: '1700000006',
    email: null,
    phone: '0991000006',
    status: 'ACTIVE',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'mock-00000001-0000-0000-0000-000000000007',
    fullName: 'Cliente de Ejemplo 07',
    cedula: '1700000007',
    email: 'ejemplo07@ficcion.test',
    phone: '0991000007',
    status: 'INACTIVE',
    createdAt: '2026-01-16T10:00:00Z',
    updatedAt: '2026-01-20T09:00:00Z',
  },
]

// Estado persistente durante la sesión de la app
let store: CustomerView[] = [...MOCK_SEED]
let nextId = 100

// Latencia simulada para imitar al backend
function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function now(): string {
  return new Date().toISOString()
}

function matchesSearch(customer: CustomerView, search: string): boolean {
  const q = search.toLowerCase()
  return (
    customer.fullName.toLowerCase().includes(q) ||
    (customer.cedula?.toLowerCase().includes(q) ?? false) ||
    (customer.email?.toLowerCase().includes(q) ?? false)
  )
}

//SOLID: SRP — ESTA CLASE IMPLEMENTA EL REPOSITORIO EN MEMORIA PARA DESARROLLO Y PRUEBAS.
export class CustomerMockRepository implements CustomerRepository {
  async list(filters: CustomerFilters = {}, page = 0): Promise<CustomerPage> {
    await delay(300)

    const PAGE_SIZE = 5

    let result = [...store]

    if (filters.status) {
      result = result.filter((c) => c.status === filters.status)
    }

    if (filters.search && filters.search.trim() !== '') {
      result = result.filter((c) => matchesSearch(c, filters.search!.trim()))
    }

    // Orden estable por fecha de creación ascendente
    result.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    const start = page * PAGE_SIZE
    const slice = result.slice(start, start + PAGE_SIZE)

    return {
      items: slice,
      page,
      size: slice.length,
      hasNext: start + PAGE_SIZE < result.length,
    }
  }

  async create(input: CustomerInput): Promise<CustomerView> {
    await delay(300)

    const trimmedName = input.fullName?.trim() ?? ''
    if (!trimmedName) {
      throw new CustomerApiError('El nombre es obligatorio.', 'validation')
    }

    const cedula = input.cedula?.trim() ?? null
    const email = input.email?.trim().toLowerCase() ?? null
    const phone = input.phone?.trim() ?? null

    if (cedula !== null && cedula !== '') {
      if (!/^\d{10}$/.test(cedula)) {
        throw new CustomerApiError('La cédula debe tener exactamente 10 dígitos.', 'validation')
      }
      const duplicate = store.find((c) => c.cedula === cedula)
      if (duplicate) {
        throw new CustomerApiError(
          'Ya existe un cliente con esa cédula.',
          'duplicate',
          409,
        )
      }
    }

    if (email !== null && email !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        throw new CustomerApiError('El formato del correo no es válido.', 'validation')
      }
      const duplicate = store.find((c) => c.email === email)
      if (duplicate) {
        throw new CustomerApiError(
          'Ya existe un cliente con ese correo.',
          'duplicate',
          409,
        )
      }
    }

    const created: CustomerView = {
      id: `mock-generated-${String(nextId++).padStart(8, '0')}`,
      fullName: trimmedName,
      cedula: cedula || null,
      email: email || null,
      phone: phone || null,
      status: 'ACTIVE',
      createdAt: now(),
      updatedAt: now(),
    }

    store = [...store, created]
    return created
  }

  async setStatus(id: string, status: CustomerStatus): Promise<CustomerView> {
    await delay(300)

    const idx = store.findIndex((c) => c.id === id)
    if (idx === -1) {
      throw new CustomerApiError('Cliente no encontrado.', 'unknown', 404)
    }

    const updated: CustomerView = { ...store[idx], status, updatedAt: now() }
    store = store.map((c) => (c.id === id ? updated : c))
    return updated
  }
}

/** Permite reiniciar el store en pruebas */
export function resetMockStore(): void {
  store = [...MOCK_SEED]
  nextId = 100
}
