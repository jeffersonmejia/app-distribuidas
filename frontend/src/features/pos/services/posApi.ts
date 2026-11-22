// SOLID: SRP — IMPLEMENTA EL ADAPTADOR HTTP DEL CONTRATO TRANSACCIONAL DE POS.

import { getApiConfig } from '../../crm/config/apiConfig'
import type { ContractSaleInput, ContractSaleView, Sale, SaleFilters, SalePage, CreateSaleInput } from '../types/sale'
import { PosApiError, type PosRepository } from './posRepository'

const BASE = '/api/v1/pos/sales'
interface SaleDto extends ContractSaleView {}
interface PageDto<T> { items: T[]; page: number; size: number; hasNext: boolean }

//SOLID: SRP — CREA LOS HEADERS DE AUTENTICACIÓN Y TENANT PARA POS.
function headers(): Record<string, string> {
  const config = getApiConfig()
  return {
    'Content-Type': 'application/json',
    ...(config.accessToken ? { Authorization: `Bearer ${config.accessToken}` } : {}),
    ...(config.tenantId ? { 'X-Tenant-ID': config.tenantId } : {}),
  }
}

//SOLID: SRP — CONVIERTE USD DECIMAL A CENTAVOS PARA LOS COMPONENTES EXISTENTES.
function cents(value: string): number { return Math.round(Number(value) * 100) }

//SOLID: SRP — ADAPTA LA VENTA CONFIRMADA SIN INVENTAR CLIENTE, ESTADO DE PAGO O COMPROBANTE.
function sale(dto: SaleDto): Sale {
  const lines = dto.lines.map((line) => ({
    productId: line.productId,
    unit: line.unit,
    quantity: Number(line.quantity),
    unitPriceCents: cents(line.unitPrice),
    subtotalCents: cents(line.netAmount),
    taxAmountCents: cents(line.taxAmount),
  }))
  const totalCents = dto.lines.reduce((sum, line) => sum + cents(line.netAmount) + cents(line.taxAmount), 0)
  return {
    id: dto.saleId,
    saleId: dto.saleId,
    movementId: dto.movementId,
    createdAt: dto.createdAt,
    status: 'confirmed',
    lines,
    totalCents,
  }
}

//SOLID: SRP — TRADUCE RESPUESTAS HTTP A ERRORES DE POS SIN DETALLES INTERNOS.
async function apiError(response: Response): Promise<PosApiError> {
  let code = ''
  try { code = String((await response.json() as { code?: string }).code ?? '') } catch { /* respuesta vacía */ }
  if (response.status === 401 || response.status === 403) return new PosApiError('No tienes una sesión o permiso válido.', 'unknown')
  if (response.status === 404) return new PosApiError('No se encontró la venta solicitada.', 'not_found')
  if (response.status === 409 && code === 'INSUFFICIENT_AVAILABILITY') {
    return new PosApiError('No hay existencias suficientes para registrar la venta.', 'insufficient_availability')
  }
  if (response.status === 409) return new PosApiError('La venta entra en conflicto con una operación existente.', 'conflict')
  if (response.status === 400) return new PosApiError('Revisa las líneas y los importes ingresados.', 'validation')
  return new PosApiError('No se pudo completar la operación de POS.', 'unknown')
}

//SOLID: SRP — EJECUTA REQUESTS POS Y CENTRALIZA FALLAS DE RED.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getApiConfig()
  let response: Response
  try { response = await fetch(`${config.baseUrl}${path}`, { ...init, headers: { ...headers(), ...init?.headers } }) }
  catch { throw new PosApiError('No se pudo conectar con POS.', 'service_unavailable') }
  if (!response.ok) throw await apiError(response)
  return await response.json() as T
}

//SOLID: SRP — IMPLEMENTA LAS CONSULTAS Y REGISTRO DE VENTAS APROBADAS.
export class PosApiRepository implements PosRepository {
  readonly contractOnly = true

  //SOLID: SRP — CONSULTA VENTAS CONFIRMADAS CON PAGINACIÓN DE MÁXIMO CINCO.
  async list(filters: SaleFilters = {}, page = 0): Promise<SalePage> {
    if (filters.status && filters.status !== 'confirmed') return { items: [], page, size: 5, hasNext: false }
    const query = new URLSearchParams({ page: String(page), size: '5' })
    if (filters.search?.trim()) query.set('search', filters.search.trim())
    const result = await request<PageDto<SaleDto>>(`${BASE}?${query}`)
    return { ...result, items: result.items.map(sale) }
  }

  //SOLID: SRP — OBTIENE UNA VENTA CONFIRMADA POR UUID.
  async getById(id: string): Promise<Sale> { return sale(await request<SaleDto>(`${BASE}/${encodeURIComponent(id)}`)) }

  //SOLID: SRP — REGISTRA LA VENTA CON EL DTO EXACTO DE POS-002.
  async createFromContract(input: ContractSaleInput): Promise<ContractSaleView> {
    return request(BASE, { method: 'POST', body: JSON.stringify(input) })
  }

  //SOLID: SRP — RECHAZA CAMPOS DEL ANTIGUO FORMULARIO QUE POS-002 NO PERSISTE.
  async createSale(_input: CreateSaleInput): Promise<Sale> {
    throw new PosApiError('Usa el formulario de venta que solicita unidad, cantidad, precio e impuesto por línea.', 'validation')
  }
}
