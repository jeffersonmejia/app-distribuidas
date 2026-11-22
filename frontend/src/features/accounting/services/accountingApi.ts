// SOLID: SRP — IMPLEMENTA EL ADAPTADOR HTTP DE CONSULTA CONTABLE.

import { getApiConfig } from '../../crm/config/apiConfig'
import type { AccountingRepository } from './accountingRepository'
import { AccountingApiError } from './accountingRepository'
import type { AccountingSummary, JournalEntry, JournalEntryFilters, JournalEntryPage } from '../types/accounting'

const BASE = '/api/v1/accounting/entries'
interface EntryDto {
  id: string; saleId: string; reversalId: string | null; originalId: string | null; createdAt: string
  movements: Array<{ account: string; side: 'DEBIT' | 'CREDIT'; amount: string }>
}
interface PageDto<T> { items: T[]; page: number; size: number; hasNext: boolean }
const ACCOUNT_NAMES: Record<string, string> = {
  CASH_BANK: 'Caja/Bancos', SALES: 'Ventas', TAX_PAYABLE: 'Impuestos por pagar',
}

//SOLID: SRP — CONSTRUYE HEADERS DE SESIÓN Y SELECTOR TENANT PARA ACCOUNTING.
function headers(): Record<string, string> {
  const config = getApiConfig()
  return {
    'Content-Type': 'application/json',
    ...(config.accessToken ? { Authorization: `Bearer ${config.accessToken}` } : {}),
    ...(config.tenantId ? { 'X-Tenant-ID': config.tenantId } : {}),
  }
}

//SOLID: SRP — ADAPTA LOS MOVIMIENTOS PERSISTIDOS A LA VISTA DE CONSULTA.
function entry(dto: EntryDto): JournalEntry {
  return {
    id: dto.id,
    code: dto.saleId,
    date: dto.createdAt,
    glosa: dto.reversalId ? 'Reverso total de venta' : 'Asiento de venta',
    lines: dto.movements.map((movement, index) => ({
      id: `${dto.id}-${index}`,
      accountCode: '',
      accountName: ACCOUNT_NAMES[movement.account] ?? movement.account,
      debitCents: movement.side === 'DEBIT' ? Math.round(Number(movement.amount) * 100) : 0,
      creditCents: movement.side === 'CREDIT' ? Math.round(Number(movement.amount) * 100) : 0,
    })),
    createdAt: dto.createdAt,
    updatedAt: dto.createdAt,
  }
}

//SOLID: SRP — MANEJA ERRORES HTTP SIN MOSTRAR MENSAJES INTERNOS.
async function error(response: Response): Promise<AccountingApiError> {
  if (response.status === 404) return new AccountingApiError('No se encontró el asiento solicitado.', 'not_found')
  if (response.status === 400) return new AccountingApiError('Revisa el filtro ingresado.', 'validation')
  if (response.status === 401 || response.status === 403) return new AccountingApiError('No tienes una sesión o permiso válido.', 'unknown')
  return new AccountingApiError('No se pudo completar la consulta contable.', 'unknown')
}

//SOLID: SRP — EJECUTA REQUESTS REST CONTABLES Y NORMALIZA FALLAS DE RED.
async function request<T>(path: string): Promise<T> {
  const config = getApiConfig()
  let response: Response
  try { response = await fetch(`${config.baseUrl}${path}`, { headers: headers() }) }
  catch { throw new AccountingApiError('No se pudo conectar con Accounting.', 'service_unavailable') }
  if (!response.ok) throw await error(response)
  return await response.json() as T
}

//SOLID: SRP — IMPLEMENTA LAS CONSULTAS READ-ONLY DEL MÓDULO CONTABLE.
export class AccountingApiRepository implements AccountingRepository {
  readonly contractOnly = true
  //SOLID: SRP — LISTA ASIENTOS DEL SERVIDOR CON FILTROS Y MÁXIMO CINCO ELEMENTOS.
  async listEntries(filters: JournalEntryFilters = {}, page = 0): Promise<JournalEntryPage> {
    const query = new URLSearchParams({ page: String(page), size: '5' })
    if (filters.search?.trim()) query.set('search', filters.search.trim())
    if (filters.period) query.set('period', filters.period)
    const result = await request<PageDto<EntryDto>>(`${BASE}?${query}`)
    return { ...result, items: result.items.map(entry) }
  }
  //SOLID: SRP — CONSULTA UN ASIENTO POR SU UUID PERSISTIDO.
  async getEntry(id: string): Promise<JournalEntry> { return entry(await request<EntryDto>(`${BASE}/${encodeURIComponent(id)}`)) }
  //SOLID: SRP — OBTIENE TOTALES AGREGADOS DESDE MOVIMIENTOS CONTABLES EXISTENTES.
  async getSummary(): Promise<AccountingSummary> {
    const result = await request<{ totalEntries: number; totalDebit: string; totalCredit: string }>(`${BASE}/summary`)
    return {
      totalEntries: result.totalEntries,
      totalDebitCents: Math.round(Number(result.totalDebit) * 100),
      totalCreditCents: Math.round(Number(result.totalCredit) * 100),
    }
  }
}
