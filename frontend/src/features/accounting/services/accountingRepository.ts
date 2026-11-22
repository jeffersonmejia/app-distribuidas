// SOLID: ISP - DEFINE EL CONTRATO Y ERRORES DEL REPOSITORIO DE CONTABILIDAD.

import type {
  AccountingSummary,
  JournalEntry,
  JournalEntryFilters,
  JournalEntryPage,
} from '../types/accounting'

export type AccountingErrorKind = 'not_found' | 'validation' | 'service_unavailable' | 'unknown'

export class AccountingApiError extends Error {
  readonly kind: AccountingErrorKind

  constructor(message: string, kind: AccountingErrorKind) {
    super(message)
    this.name = 'AccountingApiError'
    this.kind = kind
  }
}

export interface AccountingRepository {
  readonly contractOnly?: boolean
  listEntries(filters?: JournalEntryFilters, page?: number): Promise<JournalEntryPage>
  getEntry(id: string): Promise<JournalEntry>
  getSummary(): Promise<AccountingSummary>
}
