// SOLID: SRP - DEFINE LOS TIPOS DEL MODULO CONTABLE DE SOLO CONSULTA.

export type JournalEntryStatus = 'POSTED' | 'PENDING' | 'REVERSED'

export interface JournalEntryLine {
  id: string
  accountCode: string
  accountName: string
  debitCents: number
  creditCents: number
}

export interface JournalEntry {
  id: string
  code: string
  date: string
  glosa: string
  status?: JournalEntryStatus
  lines: JournalEntryLine[]
  createdAt: string
  updatedAt: string
}

export interface JournalEntryFilters {
  search?: string
  period?: string
}

export interface JournalEntryPage {
  items: JournalEntry[]
  page: number
  size: number
  hasNext: boolean
}

export interface AccountingSummary {
  totalEntries: number
  totalDebitCents: number
  totalCreditCents: number
  pendingEntries?: number
}
