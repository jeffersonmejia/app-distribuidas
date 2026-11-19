// SOLID: SRP — DEFINE LOS TIPOS Y CONTRATOS DE DATOS DE LA FEATURE CRM.

export type CustomerStatus = 'ACTIVE' | 'INACTIVE'

export interface CustomerView {
  id: string
  fullName: string
  cedula: string | null
  email: string | null
  phone: string | null
  status: CustomerStatus
  createdAt: string
  updatedAt: string
}

export interface CustomerInput {
  fullName: string
  cedula?: string | null
  email?: string | null
  phone?: string | null
}

export interface CustomerPage {
  items: CustomerView[]
  page: number
  size: number
  hasNext: boolean
}

export interface CustomerFilters {
  search?: string
  status?: CustomerStatus
}
