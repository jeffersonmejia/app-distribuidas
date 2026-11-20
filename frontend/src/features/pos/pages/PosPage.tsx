// SOLID: SRP — ESTA PÁGINA SE ENCARGA EXCLUSIVAMENTE DE LA VISUALIZACIÓN Y GESTIÓN DEL FLUJO DE VENTAS.

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { PageHeader } from '../../../components/navigation'
import { Table, type TableColumn } from '../../../components/ui/Table'
import { Pagination } from '../../../components/navigation/Pagination'
import { Button, Badge, MetricCard, FilterTabs, type FilterTabItem, type BadgeVariant } from '../../../components/ui'
import { Spinner, Alert, EmptyState } from '../../../components/feedback'
import { SaleDetailDrawer } from '../components/SaleDetailDrawer'
import { getPosRepository, type PosRepository } from '../services'
import type { Sale, SaleStatus, SaleMetrics } from '../types/sale'
import { formatMoney } from '../../../utils/formatMoney'
import './PosPage.css'

const COLUMNS: TableColumn[] = [
  { key: 'receipt', label: 'Comprobante y Tipo' },
  { key: 'customer', label: 'Cliente / Razón Social' },
  { key: 'date', label: 'Fecha de Emisión' },
  { key: 'total', label: 'Importe Facturado', align: 'right' },
  { key: 'status', label: 'Estado', align: 'center' },
  { key: 'actions', label: 'Acciones', align: 'right' },
]

type LoadState = 'idle' | 'loading' | 'success' | 'error'

export interface PosPageProps {
  repository?: PosRepository
}

function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate)
    return isNaN(d.getTime())
      ? isoDate
      : d.toLocaleDateString('es-EC', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
  } catch {
    return isoDate
  }
}

function getStatusBadgeConfig(status: SaleStatus): { label: string; variant: BadgeVariant } {
  switch (status) {
    case 'paid':
      return { label: 'Pagada', variant: 'success' }
    case 'pending':
      return { label: 'Pendiente', variant: 'warning' }
    case 'overdue':
      return { label: 'Vencida', variant: 'error' }
  }
}

export function PosPage({ repository }: PosPageProps) {
  const repo = repository ?? getPosRepository()

  const [sales, setSales] = useState<Sale[]>([])
  const [page, setPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SaleStatus | ''>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [metrics, setMetrics] = useState<SaleMetrics | null>(null)
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false

    repo
      .list(
        {
          search: search || undefined,
          status: statusFilter || undefined,
        },
        page
      )
      .then((res) => {
        if (!ignore) {
          setSales(res.items)
          setHasNext(res.hasNext)
          setErrorMessage(null)
          setLoadState('success')
        }
      })
      .catch((err) => {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'No se pudo cargar el listado de ventas.'
          setErrorMessage(msg)
          setLoadState('error')
        }
      })

    if (repo.getMetrics) {
      repo
        .getMetrics()
        .then((data) => {
          if (!ignore) setMetrics(data)
        })
        .catch(() => {
          // Si falla métricas, no bloquea el listado
        })
    }

    return () => {
      ignore = true
    }
  }, [repo, page, search, statusFilter, reloadKey])

  function handleSearchInput(val: string) {
    setSearchInput(val)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setLoadState('loading')
      setSearch(val)
      setPage(0)
    }, 300)
  }

  function handleStatusTab(newStatus: SaleStatus | '') {
    setLoadState('loading')
    setStatusFilter(newStatus)
    setPage(0)
  }

  function handlePageChange(newPage: number) {
    setLoadState('loading')
    setPage(newPage)
  }

  function handleRetry() {
    setLoadState('loading')
    setReloadKey((prev) => prev + 1)
  }

  function handleOpenDetail(saleId: string) {
    setSelectedSaleId(saleId)
    setIsDrawerOpen(true)
  }

  function handleCloseDetail() {
    setIsDrawerOpen(false)
    setSelectedSaleId(null)
  }

  const tabs: FilterTabItem<SaleStatus | ''>[] = [
    {
      id: '',
      label: 'Todas',
      count: metrics
        ? metrics.countByStatus.paid + metrics.countByStatus.pending + metrics.countByStatus.overdue
        : undefined,
    },
    {
      id: 'paid',
      label: 'Pagadas',
      count: metrics?.countByStatus.paid,
    },
    {
      id: 'pending',
      label: 'Pendientes',
      count: metrics?.countByStatus.pending,
    },
    {
      id: 'overdue',
      label: 'Vencidas',
      count: metrics?.countByStatus.overdue,
    },
  ]

  const totalTransactions = metrics
    ? metrics.countByStatus.paid + metrics.countByStatus.pending + metrics.countByStatus.overdue
    : sales.length

  const headerDescription = metrics
    ? `Ventas del mes: ${formatMoney(metrics.totalSalesThisMonthCents)} · ${totalTransactions} ${totalTransactions === 1 ? 'transacción registrada' : 'transacciones registradas'}`
    : `Ventas del mes: $0.00 · ${sales.length} ${sales.length === 1 ? 'transacción registrada' : 'transacciones registradas'}`

  let content: ReactNode = null

  if (loadState === 'loading' && sales.length === 0) {
    content = (
      <div className="pos-page__loading" role="status">
        <Spinner size="lg" label="Cargando comprobantes de venta..." />
      </div>
    )
  } else if (loadState === 'error') {
    content = (
      <div className="pos-page__error">
        <Alert variant="error" title="Error al cargar comprobantes">
          {errorMessage || 'Ocurrió un error inesperado al consultar los comprobantes.'}
        </Alert>
        <div className="pos-page__error-action">
          <Button variant="secondary" onClick={handleRetry}>
            Reintentar
          </Button>
        </div>
      </div>
    )
  } else if (sales.length === 0) {
    content = (
      <div className="pos-page__empty">
        <EmptyState
          title="No se encontraron ventas"
          description={
            search || statusFilter
              ? 'No hay comprobantes que coincidan con los filtros aplicados.'
              : 'Aún no se han registrado comprobantes de venta en la organización.'
          }
        />
      </div>
    )
  } else {
    content = (
      <Table columns={COLUMNS} ariaLabel="Listado de comprobantes de ventas">
        {sales.map((sale) => {
          const badgeCfg = getStatusBadgeConfig(sale.status)
          return (
            <tr key={sale.id} className="pos-page__table-row">
              <td className="pos-page__receipt-cell">
                <div className="pos-page__receipt-wrapper">
                  <div className="pos-page__receipt-icon" aria-hidden="true">
                    <svg fill="currentColor" viewBox="0 0 24 24" width="20" height="20">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14l4-2 4 2 4-2 4 2V5c0-1.1-.9-2-2-2zm0 13.82l-2-1-4 2-4-2-2 1V5h12v11.82zM7 7h10v2H7zm0 4h7v2H7z" />
                    </svg>
                  </div>
                  <div className="pos-page__receipt-text">
                    <span className="pos-page__receipt-number">{sale.receiptNumber}</span>
                    <span className="pos-page__receipt-type">{sale.type}</span>
                  </div>
                </div>
              </td>
              <td className="pos-page__customer-cell">
                <div className="pos-page__customer-wrapper">
                  <span className="pos-page__customer-name">{sale.customerName}</span>
                  <span className="pos-page__customer-id">{sale.customerIdentification}</span>
                </div>
              </td>
              <td className="pos-page__date-cell">{formatDate(sale.issuedAt)}</td>
              <td className="pos-page__total-cell pos-page__cell--right">
                <span className="pos-page__total-amount">{formatMoney(sale.totalCents)}</span>
              </td>
              <td className="pos-page__status-cell pos-page__cell--center">
                <Badge variant={badgeCfg.variant}>{badgeCfg.label}</Badge>
              </td>
              <td className="pos-page__actions-cell pos-page__cell--right">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleOpenDetail(sale.id)}
                  aria-label={`Ver detalle del comprobante ${sale.receiptNumber}`}
                >
                  Ver detalle
                </Button>
              </td>
            </tr>
          )
        })}
      </Table>
    )
  }

  return (
    <div className="pos-page">
      <PageHeader
        title="Ventas"
        description={headerDescription}
        badgeText="MÓDULO ACTIVO"
        searchValue={searchInput}
        onSearchChange={handleSearchInput}
        searchPlaceholder="Buscar por comprobante, cliente o RUC..."
        actions={
          <div className="pos-page__header-actions">
            <Button
              variant="secondary"
              disabled
              title="Exportación de ventas disponible en el siguiente sprint"
            >
              Exportar ventas
            </Button>
            <Button
              variant="primary"
              disabled
              title="La creación de ventas por POS requiere contratos y backend aprobados"
            >
              + Nueva venta
            </Button>
          </div>
        }
        footer={
          <FilterTabs<SaleStatus | ''>
            tabs={tabs}
            activeTab={statusFilter}
            onTabChange={handleStatusTab}
            ariaLabel="Filtro por estado de venta"
            className="pos-page__tabs"
          />
        }
      />

      {/* Métricas KPI */}
      <section className="pos-page__kpis" aria-label="Resumen de ventas">
        <MetricCard
          title="Ventas del mes"
          value={metrics ? formatMoney(metrics.totalSalesThisMonthCents) : '$0.00'}
          subtitle={
            metrics
              ? `${metrics.countByStatus.paid} ${metrics.countByStatus.paid === 1 ? 'comprobante pagado' : 'comprobantes pagados'}`
              : undefined
          }
          iconVariant="primary"
          icon={
            <svg fill="currentColor" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
            </svg>
          }
        />
        <MetricCard
          title="Por cobrar"
          value={metrics ? formatMoney(metrics.pendingCents) : '$0.00'}
          subtitle={
            metrics
              ? `${metrics.countByStatus.pending} ${metrics.countByStatus.pending === 1 ? 'comprobante pendiente' : 'comprobantes pendientes'}`
              : '0 pendientes'
          }
          iconVariant="warning"
          icon={
            <svg fill="currentColor" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z" />
            </svg>
          }
        />
        <MetricCard
          title="Vencidas"
          value={metrics ? formatMoney(metrics.overdueCents) : '$0.00'}
          subtitle={
            metrics
              ? `${metrics.countByStatus.overdue} ${metrics.countByStatus.overdue === 1 ? 'factura vencida' : 'facturas vencidas'}`
              : '0 vencidas'
          }
          iconVariant="neutral"
          icon={
            <svg fill="currentColor" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            </svg>
          }
        />
      </section>

      {/* Contenedor del Listado */}
      <section className="pos-page__list" aria-label="Comprobantes">
        {content}
      </section>

      {/* Paginación */}
      <Pagination
        currentPage={page}
        hasNext={hasNext}
        onPageChange={handlePageChange}
        isLoading={loadState === 'loading'}
        itemsCount={sales.length}
        itemLabel="venta"
        itemLabelPlural="ventas"
      />

      {/* Drawer de Detalle */}
      <SaleDetailDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDetail}
        saleId={selectedSaleId}
        repository={repo}
      />
    </div>
  )
}
