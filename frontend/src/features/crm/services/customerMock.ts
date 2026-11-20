// SOLID: SRP — IMPLEMENTACIÓN EN MEMORIA DEL REPOSITORIO DE CLIENTES PARA DESARROLLO Y PRUEBAS CON AISLAMIENTO MULTITENANT.

import type {
  CustomerFilters,
  CustomerInput,
  CustomerMetrics,
  CustomerPage,
  CustomerStatus,
  CustomerView,
} from '../types/customer'
import { CustomerApiError, type CustomerRepository } from './customerRepository'

const DEFAULT_TENANT_ID = 'tnt-andina-001'

// Datos ficticios de clientes por organización (tenant)
const MOCK_SEED_BY_TENANT: Record<string, CustomerView[]> = {
  'tnt-andina-001': [
    {
      id: 'mock-andina-00000001',
      fullName: 'Carlos Alberto Mendoza',
      cedula: '1790000001',
      email: 'carlos.mendoza@ficcion.test',
      phone: '0991000001',
      status: 'ACTIVE',
      createdAt: '2026-01-10T10:00:00Z',
      updatedAt: '2026-01-10T10:00:00Z',
    },
    {
      id: 'mock-andina-00000002',
      fullName: 'Lucía del Carmen Viteri',
      cedula: '1790000002',
      email: 'lucia.viteri@ficcion.test',
      phone: '0991000002',
      status: 'ACTIVE',
      createdAt: '2026-01-11T10:00:00Z',
      updatedAt: '2026-01-11T10:00:00Z',
    },
    {
      id: 'mock-andina-00000003',
      fullName: 'Esteban Patricio Paredes',
      cedula: '1790000003',
      email: 'esteban.paredes@ficcion.test',
      phone: '0991000003',
      status: 'INACTIVE',
      createdAt: '2026-01-12T10:00:00Z',
      updatedAt: '2026-01-15T08:00:00Z',
    },
    {
      id: 'mock-andina-00000004',
      fullName: 'Valeria Sofía Espinoza',
      cedula: '1790000004',
      email: 'valeria.espinoza@ficcion.test',
      phone: null,
      status: 'ACTIVE',
      createdAt: '2026-01-13T10:00:00Z',
      updatedAt: '2026-01-13T10:00:00Z',
    },
    {
      id: 'mock-andina-00000005',
      fullName: 'Gabriel Alejandro Salazar',
      cedula: null,
      email: 'gabriel.salazar@ficcion.test',
      phone: '0991000005',
      status: 'ACTIVE',
      createdAt: '2026-01-14T10:00:00Z',
      updatedAt: '2026-01-14T10:00:00Z',
    },
    {
      id: 'mock-andina-00000006',
      fullName: 'Camila Mercedes Benítez',
      cedula: '1790000006',
      email: null,
      phone: '0991000006',
      status: 'ACTIVE',
      createdAt: '2026-01-15T10:00:00Z',
      updatedAt: '2026-01-15T10:00:00Z',
    },
    {
      id: 'mock-andina-00000007',
      fullName: 'Mateo Daniel Cevallos',
      cedula: '1790000007',
      email: 'mateo.cevallos@ficcion.test',
      phone: '0991000007',
      status: 'INACTIVE',
      createdAt: '2026-01-16T10:00:00Z',
      updatedAt: '2026-01-20T09:00:00Z',
    },
  ],
  'tnt-pacifico-002': [
    {
      id: 'mock-pacifico-00000001',
      fullName: 'Andrés Felipe Morales',
      cedula: '0992000001',
      email: 'andres.morales@ficcion.test',
      phone: '0982000001',
      status: 'ACTIVE',
      createdAt: '2026-02-01T10:00:00Z',
      updatedAt: '2026-02-01T10:00:00Z',
    },
    {
      id: 'mock-pacifico-00000002',
      fullName: 'Daniela Rocío Zambrano',
      cedula: '0992000002',
      email: 'daniela.zambrano@ficcion.test',
      phone: '0982000002',
      status: 'ACTIVE',
      createdAt: '2026-02-02T10:00:00Z',
      updatedAt: '2026-02-02T10:00:00Z',
    },
  ],
  'tnt-austro-003': [
    {
      id: 'mock-austro-00000001',
      fullName: 'Joaquín Ignacio Cordero',
      cedula: '0193000001',
      email: 'joaquin.cordero@ficcion.test',
      phone: '0973000001',
      status: 'ACTIVE',
      createdAt: '2026-02-10T10:00:00Z',
      updatedAt: '2026-02-10T10:00:00Z',
    },
    {
      id: 'mock-austro-00000002',
      fullName: 'Beatriz Elena Ordóñez',
      cedula: '0193000002',
      email: 'beatriz.ordonez@ficcion.test',
      phone: null,
      status: 'INACTIVE',
      createdAt: '2026-02-11T10:00:00Z',
      updatedAt: '2026-02-12T10:00:00Z',
    },
  ],
}

// Almacén en memoria separado por ID de tenant
let tenantStores = new Map<string, CustomerView[]>()
let nextId = 100

function initStores(): void {
  tenantStores = new Map<string, CustomerView[]>()
  for (const [tId, seedList] of Object.entries(MOCK_SEED_BY_TENANT)) {
    tenantStores.set(tId, [...seedList])
  }
}

// Inicialización inicial
initStores()

function getSafeActiveTenantId(): string {
  try {
    return localStorage.getItem('app_active_tenant_id') || DEFAULT_TENANT_ID
  } catch {
    return DEFAULT_TENANT_ID
  }
}

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

// SOLID: SRP — ESTA CLASE IMPLEMENTA EL REPOSITORIO EN MEMORIA RESPETANDO EL AISLAMIENTO POR TENANT.
export class CustomerMockRepository implements CustomerRepository {
  private explicitTenantId?: string

  constructor(explicitTenantId?: string) {
    this.explicitTenantId = explicitTenantId
  }

  private getActiveTenant(): string {
    return this.explicitTenantId ?? getSafeActiveTenantId()
  }

  private getStore(): CustomerView[] {
    const tId = this.getActiveTenant()
    if (!tenantStores.has(tId)) {
      const seed = MOCK_SEED_BY_TENANT[tId] ?? []
      tenantStores.set(tId, [...seed])
    }
    return tenantStores.get(tId)!
  }

  private saveStore(items: CustomerView[]): void {
    const tId = this.getActiveTenant()
    tenantStores.set(tId, items)
  }

  async list(filters: CustomerFilters = {}, page = 0): Promise<CustomerPage> {
    await delay(300)

    const PAGE_SIZE = 5
    const store = this.getStore()
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

    const store = this.getStore()
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

    this.saveStore([...store, created])
    return created
  }

  async update(id: string, input: CustomerInput): Promise<CustomerView> {
    await delay(300)

    const store = this.getStore()
    const idx = store.findIndex((c) => c.id === id)
    if (idx === -1) {
      throw new CustomerApiError('Cliente no encontrado.', 'unknown', 404)
    }

    const trimmedName = input.fullName.trim()
    if (!trimmedName) {
      throw new CustomerApiError('El nombre completo es obligatorio.', 'validation', 400)
    }

    const cedula = input.cedula?.trim() || null
    if (cedula) {
      if (!/^\d{10}$/.test(cedula)) {
        throw new CustomerApiError('La cédula debe tener exactamente 10 dígitos numéricos.', 'validation', 400)
      }
      const duplicate = store.find((c) => c.id !== id && c.cedula === cedula)
      if (duplicate) {
        throw new CustomerApiError('Ya existe un cliente con esa cédula.', 'duplicate', 409)
      }
    }

    const email = input.email?.trim().toLowerCase() || null
    if (email) {
      const duplicate = store.find((c) => c.id !== id && c.email === email)
      if (duplicate) {
        throw new CustomerApiError('Ya existe un cliente con ese correo.', 'duplicate', 409)
      }
    }

    const updated: CustomerView = {
      ...store[idx],
      fullName: trimmedName,
      cedula,
      email,
      phone: input.phone?.trim() || null,
      updatedAt: now(),
    }

    this.saveStore(store.map((c) => (c.id === id ? updated : c)))
    return updated
  }

  async archive(id: string): Promise<void> {
    await delay(300)
    const store = this.getStore()
    const idx = store.findIndex((c) => c.id === id)
    if (idx === -1) {
      throw new CustomerApiError('Cliente no encontrado.', 'unknown', 404)
    }
    this.saveStore(store.filter((c) => c.id !== id))
  }

  async setStatus(id: string, status: CustomerStatus): Promise<CustomerView> {
    await delay(300)
    const store = this.getStore()
    const idx = store.findIndex((c) => c.id === id)
    if (idx === -1) {
      throw new CustomerApiError('Cliente no encontrado.', 'unknown', 404)
    }

    const updated: CustomerView = { ...store[idx], status, updatedAt: now() }
    this.saveStore(store.map((c) => (c.id === id ? updated : c)))
    return updated
  }

  // SOLID: SRP — CALCULA MÉTRICAS DE CLIENTES EN MEMORIA PARA EL TENANT ACTIVO.
  async getMetrics(): Promise<CustomerMetrics> {
    await delay(100)
    const store = this.getStore()
    const totalClientes = store.length
    const activos = store.filter((c) => c.status === 'ACTIVE').length
    const inactivos = store.filter((c) => c.status === 'INACTIVE').length
    const nuevosEsteMes = Math.min(totalClientes, 3)
    return {
      totalClientes,
      activos,
      inactivos,
      nuevosEsteMes,
    }
  }
}

/** Permite reiniciar el store en pruebas */
export function resetMockStore(): void {
  initStores()
  nextId = 100
}
