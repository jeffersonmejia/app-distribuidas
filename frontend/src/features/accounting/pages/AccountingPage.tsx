// SOLID: SRP - RENDERIZA LA CONSULTA DEL LIBRO DIARIO CONTABLE SIN ACCIONES DE ESCRITURA.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { PageHeader } from '../../../components/navigation'
import { Table, type TableColumn } from '../../../components/ui/Table'
import { Pagination } from '../../../components/navigation/Pagination'
import { Button, Badge, MetricCard } from '../../../components/ui'
import { Spinner, Alert, EmptyState } from '../../../components/feedback'
import { useSession } from '../../identity/hooks'
import { getAccountingRepository, type AccountingRepository } from '../services'
import type { AccountingSummary, JournalEntry, JournalEntryStatus } from '../types/accounting'
import { formatAccountingAmount } from '../utils/formatters'
import { formatCalendarDate } from '../../../utils/formatDate'
import { AccountingEntryDrawer } from '../components/AccountingEntryDrawer'
import './AccountingPage.css'

const COLUMNS: TableColumn[] = [
  { key: 'date', label: 'Fecha y código' },
  { key: 'glosa', label: 'Glosa' },
  { key: 'accounts', label: 'Cuentas' },
  { key: 'debit', label: 'Debe', align: 'right' },
  { key: 'credit', label: 'Haber', align: 'right' },
  { key: 'status', label: 'Estado' },
  { key: 'actions', label: 'Acciones', align: 'right' },
]

type LoadState = 'idle' | 'loading' | 'success' | 'error'

function formatAmount(cents: number): string {
  return formatAccountingAmount(cents)
}

function statusLabel(status: JournalEntryStatus): string {
  if (status === 'POSTED') return 'Mayorizado'
  if (status === 'PENDING') return 'Pendiente'
  return 'Reversado'
}

function statusVariant(status: JournalEntryStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'POSTED') return 'success'
  if (status === 'PENDING') return 'warning'
  return 'neutral'
}

function entryTotalDebit(entry: JournalEntry): number {
  return entry.lines.reduce((sum, line) => sum + line.debitCents, 0)
}

function entryTotalCredit(entry: JournalEntry): number {
  return entry.lines.reduce((sum, line) => sum + line.creditCents, 0)
}

function periodLabel(period: string): string {
  const [year, month] = period.split('-')
  const names = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const index = Number(month) - 1
  return names[index] ? `${names[index]} ${year}` : period
}

export interface AccountingPageProps {
  repository?: AccountingRepository
}

export function AccountingPage({ repository }: AccountingPageProps) {
  const { tenant } = useSession()
  const tenantId = tenant?.id
  const repo = useMemo(() => {
    void tenantId
    return repository ?? getAccountingRepository()
  }, [repository, tenantId])

  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [page, setPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('')
  const [summary, setSummary] = useState<AccountingSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let ignore = false
    async function loadEntries() {
      try {
        const result = await repo.listEntries(
          { search: search || undefined, period: period || undefined },
          page
        )
        if (ignore) return
        setEntries(result.items)
        setHasNext(result.hasNext)
        setErrorMessage(null)
        setLoadState('success')
      } catch (error) {
        if (ignore) return
        setErrorMessage(error instanceof Error ? error.message : 'No se pudieron cargar los asientos contables.')
        setLoadState('error')
      }
    }
    void loadEntries()
    return () => {
      ignore = true
    }
  }, [repo, page, search, period, reloadKey])

  useEffect(() => {
    let ignore = false
    async function loadSummary() {
      setSummaryLoading(true)
      try {
        const data = await repo.getSummary()
        if (!ignore) setSummary(data)
      } catch {
        if (!ignore) setSummary(null)
      } finally {
        if (!ignore) setSummaryLoading(false)
      }
    }
    void loadSummary()
    return () => {
      ignore = true
    }
  }, [repo, reloadKey])

  const periodOptions = useMemo(() => {
    const months = new Set<string>()
    for (const entry of entries) months.add(entry.date.slice(0, 7))
    if (period) months.add(period)
    return Array.from(months).sort((a, b) => b.localeCompare(a))
  }, [entries, period])

  function handleSearchChange(value: string) {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setLoadState('loading')
      setErrorMessage(null)
      setSearch(value)
      setPage(0)
    }, 300)
  }

  function handlePeriodChange(value: string) {
    setLoadState('loading')
    setErrorMessage(null)
    setPeriod(value)
    setPage(0)
  }

  function handleRetry() {
    setLoadState('loading')
    setErrorMessage(null)
    setReloadKey((prev) => prev + 1)
  }

  let content: ReactNode
  if (loadState === 'loading') {
    content = (
      <div className="accounting-page__state">
        <Spinner size="lg" label="Cargando asientos contables..." />
      </div>
    )
  } else if (loadState === 'error') {
    content = (
      <Alert variant="error" title="Error al cargar contabilidad">
        <p>{errorMessage}</p>
        <Button variant="secondary" size="sm" onClick={handleRetry}>
          Reintentar
        </Button>
      </Alert>
    )
  } else if (entries.length === 0) {
    content = (
      <EmptyState
        title="Sin asientos contables"
        description={
          search || period
            ? 'No se encontraron asientos con los filtros aplicados.'
            : 'No hay asientos registrados en esta organización.'
        }
      />
    )
  } else {
    content = (
      <>
        <Table columns={COLUMNS} caption="Libro diario contable">
          {entries.map((entry) => {
            const debit = entryTotalDebit(entry)
            const credit = entryTotalCredit(entry)
            return (
              <tr key={entry.id} className="accounting-page__row">
                <td className="accounting-page__cell">
                  <div className="accounting-page__date-code">
                    <span className="accounting-page__code">{entry.code}</span>
                    <span className="accounting-page__date">{formatCalendarDate(entry.date)}</span>
                  </div>
                </td>
                <td className="accounting-page__cell">
                  <span className="accounting-page__glosa">{entry.glosa}</span>
                </td>
                <td className="accounting-page__cell">
                  <div className="accounting-page__accounts">
                    {entry.lines.slice(0, 2).map((line) => (
                      <span key={line.id} className="accounting-page__account-item">
                        {line.accountCode} {line.accountName}
                      </span>
                    ))}
                    {entry.lines.length > 2 && (
                      <span className="accounting-page__account-more">+{entry.lines.length - 2} líneas</span>
                    )}
                  </div>
                </td>
                <td className="accounting-page__cell accounting-page__amount">{formatAmount(debit)}</td>
                <td className="accounting-page__cell accounting-page__amount">{formatAmount(credit)}</td>
                <td className="accounting-page__cell">
                  <Badge variant={statusVariant(entry.status)}>{statusLabel(entry.status)}</Badge>
                </td>
                <td className="accounting-page__cell accounting-page__cell--right">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedEntry(entry)}
                    aria-label={`Ver detalle de ${entry.code}`}
                  >
                    Ver detalle
                  </Button>
                </td>
              </tr>
            )
          })}
        </Table>
        <Pagination
          currentPage={page}
          hasNext={hasNext}
          onPageChange={(nextPage) => {
            setLoadState('loading')
            setPage(nextPage)
          }}
          isLoading={false}
          itemsCount={entries.length}
          itemLabel="asiento"
          itemLabelPlural="asientos"
        />
      </>
    )
  }

  return (
    <div className="accounting-page">
      <PageHeader
        title="Contabilidad"
        description="Consulta del libro diario y estado de asientos contables."
        badgeText="Módulo contable · Solo consulta"
        searchPlaceholder="Buscar por código, glosa o cuenta..."
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        actions={
          <label className="accounting-page__period" htmlFor="accounting-period-select">
            <span className="accounting-page__period-label">Período</span>
            <select id="accounting-period-select"
              className="accounting-page__period-select"
              value={period}
              onChange={(e) => handlePeriodChange(e.target.value)}
              aria-label="Seleccionar período contable"
            >
              <option value="">Todos</option>
              {periodOptions.map((option) => (
                <option key={option} value={option}>
                  {periodLabel(option)}
                </option>
              ))}
            </select>
          </label>
        }
      />

      <section className="accounting-page__metrics" aria-label="Métricas contables">
        <MetricCard title="Asientos" value={summary?.totalEntries ?? (summaryLoading ? '...' : 0)} subtitle="Registrados en el período consultado" iconVariant="primary" icon={<span aria-hidden="true">#</span>} />
        <MetricCard title="Total debe" value={formatAmount(summary?.totalDebitCents ?? 0)} subtitle="Suma de débitos" iconVariant="neutral" icon={<span aria-hidden="true">D</span>} />
        <MetricCard title="Total haber" value={formatAmount(summary?.totalCreditCents ?? 0)} subtitle="Suma de créditos" iconVariant="neutral" icon={<span aria-hidden="true">H</span>} />
        <MetricCard title="Pendientes" value={summary?.pendingEntries ?? (summaryLoading ? '...' : 0)} subtitle="Asientos por mayorización" iconVariant="warning" icon={<span aria-hidden="true">!</span>} />
      </section>

      {content}

      <AccountingEntryDrawer
        isOpen={selectedEntry !== null}
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  )
}
