// SOLID: SRP — IMPLEMENTA EL ADAPTADOR HTTP DEL CATÁLOGO Y SUS EXISTENCIAS.

import { getApiConfig } from '../../crm/config/apiConfig'
import type { InventoryMetrics, Product, ProductInput, ProductPage, ProductFilters, StockConsumptionResult } from '../types/product'
import { InventoryApiError, type InventoryRepository } from './inventoryRepository'

const BASE = '/api/v1/inventory/products'

interface ProductDto {
  id: string
  name: string
  sku: string
  category: Product['category']
  description?: string | null
  unit: string
  purchasePrice: string
  sellingPrice: string
  stock: string
  minStock: string
  status: Product['status']
  createdAt: string
  updatedAt: string
}

interface PageDto<T> {
  items: T[]
  page: number
  size: number
  hasNext: boolean
}

//SOLID: SRP — CREA HEADERS DE SESIÓN Y SELECTOR TENANT PARA EL BACKEND.
function headers(): Record<string, string> {
  const config = getApiConfig()
  return {
    'Content-Type': 'application/json',
    ...(config.accessToken ? { Authorization: `Bearer ${config.accessToken}` } : {}),
    ...(config.tenantId ? { 'X-Tenant-ID': config.tenantId } : {}),
  }
}

//SOLID: SRP — CONVIERTE EL IMPORTE EN USD A CENTAVOS PARA EL MODELO ACTUAL DE UI.
function cents(value: string): number {
  return Math.round(Number(value) * 100)
}

//SOLID: SRP — ADAPTA EL DTO HTTP AL MODELO PRESENTACIONAL DE INVENTORY.
function product(dto: ProductDto): Product {
  return {
    id: dto.id,
    name: dto.name,
    sku: dto.sku,
    unit: dto.unit,
    category: dto.category,
    description: dto.description ?? undefined,
    purchasePriceCents: cents(dto.purchasePrice),
    sellingPriceCents: cents(dto.sellingPrice),
    stock: Number(dto.stock),
    minStock: Number(dto.minStock),
    status: dto.status,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  }
}

//SOLID: SRP — TRADUCE ERRORES HTTP A MENSAJES ESTABLES SIN FILTRAR DETALLES DEL BACKEND.
async function apiError(response: Response): Promise<InventoryApiError> {
  let code = ''
  try { code = String((await response.json() as { code?: string }).code ?? '') } catch { /* cuerpo vacío */ }
  if (response.status === 401) return new InventoryApiError('Inicia sesión para continuar.', 'service_unavailable')
  if (response.status === 403) return new InventoryApiError('No tienes permiso para esta operación.', 'service_unavailable')
  if (response.status === 404) return new InventoryApiError('No se encontró el producto solicitado.', 'not_found')
  if (response.status === 409 && code === 'INSUFFICIENT_AVAILABILITY') {
    return new InventoryApiError('No hay existencias suficientes para completar la operación.', 'insufficient_availability')
  }
  if (response.status === 409) return new InventoryApiError('El producto o la operación entra en conflicto con datos existentes.', 'conflict')
  if (response.status === 400) return new InventoryApiError('Revisa los datos ingresados.', 'validation')
  return new InventoryApiError('Ocurrió un error al consultar Inventory.', 'unknown')
}

//SOLID: SRP — EJECUTA REQUESTS HTTP Y CENTRALIZA ERRORES DE TRANSPORTE.
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const config = getApiConfig()
  let response: Response
  try { response = await fetch(`${config.baseUrl}${url}`, { ...init, headers: { ...headers(), ...init?.headers } }) }
  catch { throw new InventoryApiError('No se pudo conectar con Inventory.', 'service_unavailable') }
  if (!response.ok) throw await apiError(response)
  if (response.status === 204) return undefined as T
  return await response.json() as T
}

//SOLID: SRP — IMPLEMENTA LAS OPERACIONES REST APROBADAS PARA INVENTORY.
export class InventoryApiRepository implements InventoryRepository {
  //SOLID: SRP — CONSULTA UNA PÁGINA SERVER-SIDE DE CINCO PRODUCTOS COMO MÁXIMO.
  async list(filters: ProductFilters = {}, page = 0): Promise<ProductPage> {
    const params = new URLSearchParams({ page: String(page), size: '5' })
    if (filters.search?.trim()) params.set('search', filters.search.trim())
    if (filters.category) params.set('category', filters.category)
    const result = await request<PageDto<ProductDto>>(`${BASE}?${params}`)
    return { ...result, items: result.items.map(product) }
  }

  //SOLID: SRP — CREA PRODUCTO Y EXISTENCIA INICIAL MEDIANTE EL CASO DE USO ATÓMICO.
  async create(input: ProductInput): Promise<Product> {
    const dto = await request<ProductDto>(BASE, {
      method: 'POST',
      body: JSON.stringify({
        name: input.name.trim(), sku: input.sku.trim(), category: input.category,
        description: input.description?.trim() || null, unit: input.unit.trim(),
        purchasePrice: (input.purchasePriceCents / 100).toFixed(2),
        sellingPrice: (input.sellingPriceCents / 100).toFixed(2),
        initialStock: String(input.stock), minStock: String(input.minStock),
      }),
    })
    return product(dto)
  }

  //SOLID: SRP — OBTIENE DETALLE DE PRODUCTO POR SU ID.
  async getById(productId: string): Promise<Product> {
    return product(await request<ProductDto>(`${BASE}/${encodeURIComponent(productId)}`))
  }

  //SOLID: SRP — CONSULTA LA DISPONIBILIDAD AUTORIZADA DEL PRODUCTO.
  async getAvailability(productId: string): Promise<number> {
    const result = await request<{ available: string }>(`${BASE}/${encodeURIComponent(productId)}/availability`)
    return Number(result.available)
  }

  //SOLID: SRP — INFORMA QUE EL CONSUMO DIRECTO SE HACE MEDIANTE POS PARA MANTENER ATOMICIDAD.
  async consumeStock(_lines: { productId: string; quantity: number }[]): Promise<StockConsumptionResult> {
    throw new InventoryApiError('Registra la venta mediante POS para descontar existencias.', 'validation')
  }

  //SOLID: SRP — CONSULTA MÉTRICAS AGREGADAS DE INVENTORY.
  async getMetrics(): Promise<InventoryMetrics> {
    const result = await request<{
      totalProducts: number; lowStockCount: number; totalInventoryValue: string;
      categoryCounts: Record<Product['category'], number>
    }>(`${BASE}/metrics`)
    return {
      totalProducts: result.totalProducts,
      lowStockCount: result.lowStockCount,
      totalInventoryValueCents: cents(result.totalInventoryValue),
      categoryCounts: result.categoryCounts,
    }
  }
}
