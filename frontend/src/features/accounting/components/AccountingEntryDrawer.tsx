// SOLID: SRP - PRESENTA UN ASIENTO CONTABLE EN MODO SOLO LECTURA.

import type { ReactNode } from 'react'
import { Drawer } from '../../../components/ui/Drawer'
import { Badge } from '../../../components/ui/Badge'
import { Table, type TableColumn } from '../../../components/ui/Table'
import type { JournalEntry, JournalEntryStatus } from '../types/accounting'
import { formatAccountingAmount } from '../utils/formatters'
import { formatCalendarDate } from '../../../utils/formatDate'
import './AccountingEntryDrawer.css'

const LINE_COLUMNS: TableColumn[] = [
  { key: 'account', label: 'Cuenta' },
  { key: 'debit', label: 'Debe', align: 'right' },
  { key: 'credit', label: 'Haber', align: 'right' },
]

function formatAmount(cents: number): string {
  return formatAccountingAmount(cents)
}

function statusVariant(status: JournalEntryStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'POSTED') return 'success'
  if (status === 'PENDING') return 'warning'
  return 'neutral'
}

function statusLabel(status: JournalEntryStatus): string {
  if (status === 'POSTED') return 'Mayorizado'
  if (status === 'PENDING') return 'Pendiente'
  return 'Reversado'
}

export interface AccountingEntryDrawerProps {
  isOpen: boolean
  entry: JournalEntry | null
  onClose: () => void
}

export function AccountingEntryDrawer({ isOpen, entry, onClose }: AccountingEntryDrawerProps): ReactNode {
  const totalDebit = entry?.lines.reduce((sum, line) => sum + line.debitCents, 0) ?? 0
  const totalCredit = entry?.lines.reduce((sum, line) => sum + line.creditCents, 0) ?? 0
  const balanced = totalDebit === totalCredit

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Detalle de asiento" panelClassName="accounting-entry-drawer">
      {entry ? (
        <div className="accounting-entry-drawer__content">
          <dl className="accounting-entry-drawer__meta">
            <div>
              <dt>Código</dt>
              <dd>{entry.code}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd>{formatCalendarDate(entry.date)}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>
                <Badge variant={statusVariant(entry.status)}>{statusLabel(entry.status)}</Badge>
              </dd>
            </div>
            <div className="accounting-entry-drawer__meta-full">
              <dt>Glosa</dt>
              <dd>{entry.glosa}</dd>
            </div>
          </dl>

          <Table columns={LINE_COLUMNS} caption="Líneas del asiento contable">
            {entry.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  <div className="accounting-entry-drawer__account">
                    <span className="accounting-entry-drawer__account-code">{line.accountCode}</span>
                    <span className="accounting-entry-drawer__account-name">{line.accountName}</span>
                  </div>
                </td>
                <td className="accounting-entry-drawer__amount">{formatAmount(line.debitCents)}</td>
                <td className="accounting-entry-drawer__amount">{formatAmount(line.creditCents)}</td>
              </tr>
            ))}
            <tr className="accounting-entry-drawer__totals-row">
              <td><strong>Total</strong></td>
              <td className="accounting-entry-drawer__amount"><strong>{formatAmount(totalDebit)}</strong></td>
              <td className="accounting-entry-drawer__amount"><strong>{formatAmount(totalCredit)}</strong></td>
            </tr>
          </Table>

          <p className="accounting-entry-drawer__balance" role="status" aria-live="polite">
            {balanced ? 'Verificación de cuadre: asiento balanceado.' : 'Verificación de cuadre: asiento descuadrado.'}
          </p>
        </div>
      ) : (
        <p className="accounting-entry-drawer__empty">No hay asiento seleccionado.</p>
      )}
    </Drawer>
  )
}
