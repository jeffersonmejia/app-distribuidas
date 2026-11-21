// SOLID: SRP - RENDERIZA LA PANTALLA DE CAMPANAS DE MARKETING USANDO SOLO EL REPOSITORIO.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { PageHeader } from '../../../components/navigation'
import { Table, type TableColumn } from '../../../components/ui/Table'
import { Pagination } from '../../../components/navigation/Pagination'
import { Button, Badge, MetricCard, FilterTabs, type FilterTabItem } from '../../../components/ui'
import { Spinner, Alert, EmptyState } from '../../../components/feedback'
import { useSession } from '../../identity/hooks'
import { getMarketingRepository, MarketingApiError, type MarketingRepository } from '../services'
import type { Campaign, CampaignStatus } from '../types/marketing'
import { CampaignDrawer } from '../components/CampaignDrawer'
import './MarketingPage.css'

const COLUMNS: TableColumn[] = [
  { key: 'name', label: 'Campaña' },
  { key: 'dates', label: 'Fechas' },
  { key: 'status', label: 'Estado' },
  { key: 'actions', label: 'Acciones', align: 'right' },
]

type LoadState = 'idle' | 'loading' | 'success' | 'error'

function statusLabel(status: CampaignStatus): string {
  if (status === 'DRAFT') return 'Borrador'
  if (status === 'SCHEDULED') return 'Programada'
  if (status === 'ACTIVE') return 'Activa'
  if (status === 'FINISHED') return 'Finalizada'
  return 'Cancelada'
}

function statusVariant(status: CampaignStatus): 'neutral' | 'info' | 'success' | 'warning' | 'error' {
  if (status === 'DRAFT') return 'neutral'
  if (status === 'SCHEDULED') return 'info'
  if (status === 'ACTIVE') return 'success'
  if (status === 'FINISHED') return 'warning'
  return 'error'
}

function formatDate(value: string | null): string {
  if (!value) return 'Sin fecha'
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return value
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).toLocaleDateString('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

async function fetchAllCampaigns(repo: MarketingRepository): Promise<Campaign[]> {
  const all: Campaign[] = []
  let page = 0
  let hasNext = true
  while (hasNext) {
    const result = await repo.listCampaigns({}, page)
    all.push(...result.items)
    hasNext = result.hasNext
    page += 1
  }
  return all
}

async function fetchContactCount(repo: MarketingRepository, campaigns: Campaign[]): Promise<number> {
  const ids = new Set<string>()
  for (const campaign of campaigns) {
    let page = 0
    let hasNext = true
    while (hasNext) {
      const result = await repo.listContacts(campaign.id, page)
      result.items.forEach((c) => ids.add(c.customerId))
      hasNext = result.hasNext
      page += 1
    }
  }
  return ids.size
}

export interface MarketingPageProps {
  repository?: MarketingRepository
}

// SOLID: SRP - ORQUESTA CARGA, FILTROS Y METRICAS DE CAMPANAS DE MARKETING.
export function MarketingPage({ repository }: MarketingPageProps) {
  const { tenant } = useSession()
  const tenantId = tenant?.id
  const repo = useMemo(() => {
    void tenantId
    return repository ?? getMarketingRepository()
  }, [repository, tenantId])

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [page, setPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | ''>('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [metrics, setMetrics] = useState({ total: 0, active: 0, contacts: 0, sentToday: 0 })
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    async function load() {
      try {
        const result = await repo.listCampaigns({ status: statusFilter || undefined }, page)
        if (ignore) return
        const filtered = search.trim()
          ? result.items.filter((c) => {
              const term = search.trim().toLowerCase()
              return c.name.toLowerCase().includes(term) || (c.description ?? '').toLowerCase().includes(term)
            })
          : result.items
        setCampaigns(filtered)
        setHasNext(search.trim() ? false : result.hasNext)
        setErrorMessage(null)
        setLoadState('success')
      } catch (error) {
        if (ignore) return
        const message =
          error instanceof MarketingApiError && error.kind === 'service_unavailable'
            ? 'Servicio de marketing no disponible temporalmente.'
            : error instanceof Error
              ? error.message
              : 'No se pudieron cargar las campañas.'
        setErrorMessage(message)
        setLoadState('error')
      }
    }
    void load()
    return () => {
      ignore = true
    }
  }, [repo, page, statusFilter, search, reloadKey])

  useEffect(() => {
    let ignore = false
    async function loadMetrics() {
      setMetricsLoading(true)
      try {
        const all = await fetchAllCampaigns(repo)
        const contacts = await fetchContactCount(repo, all)
        if (ignore) return
        setMetrics({
          total: all.length,
          active: all.filter((c) => c.status === 'ACTIVE').length,
          contacts,
          sentToday: 0,
        })
      } catch {
        if (!ignore) setMetrics((prev) => ({ ...prev }))
      } finally {
        if (!ignore) setMetricsLoading(false)
      }
    }
    void loadMetrics()
    return () => {
      ignore = true
    }
  }, [repo, reloadKey])

  function handleSearchChange(value: string) {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setLoadState('loading')
      setSearch(value)
      setPage(0)
    }, 300)
  }

  function handleStatusChange(next: CampaignStatus | '') {
    setLoadState('loading')
    setStatusFilter(next)
    setPage(0)
  }

  function handleRetry() {
    setLoadState('loading')
    setErrorMessage(null)
    setReloadKey((k) => k + 1)
  }

  function handleSaved(message: string, sentTodayDelta?: number) {
    setNotice(message)
    if (typeof sentTodayDelta === 'number') {
      setMetrics((prev) => ({ ...prev, sentToday: Math.max(prev.sentToday, sentTodayDelta) }))
    }
    setLoadState('loading')
    setReloadKey((k) => k + 1)
  }

  const tabs: FilterTabItem<CampaignStatus | ''>[] = [
    { id: '', label: 'Todas', count: metricsLoading ? undefined : metrics.total },
    { id: 'DRAFT', label: 'Borrador' },
    { id: 'SCHEDULED', label: 'Programada' },
    { id: 'ACTIVE', label: 'Activa', count: metricsLoading ? undefined : metrics.active },
    { id: 'FINISHED', label: 'Finalizada' },
    { id: 'CANCELLED', label: 'Cancelada' },
  ]

  let content: ReactNode
  if (loadState === 'loading') {
    content = (
      <div className="marketing-page__state">
        <Spinner size="lg" label="Cargando campañas..." />
      </div>
    )
  } else if (loadState === 'error') {
    content = (
      <Alert variant="error" title="Error al cargar marketing">
        <p>{errorMessage}</p>
        <Button variant="secondary" size="sm" onClick={handleRetry}>Reintentar</Button>
      </Alert>
    )
  } else if (campaigns.length === 0) {
    content = (
      <EmptyState
        title="Sin campañas"
        description={search || statusFilter ? 'No se encontraron campañas con los filtros aplicados.' : 'No hay campañas registradas en esta organización.'}
        action={search || statusFilter ? undefined : <Button variant="primary" onClick={() => { setSelectedCampaign(null); setDrawerOpen(true) }}>Crear campaña</Button>}
      />
    )
  } else {
    content = (
      <>
        <Table columns={COLUMNS} caption="Listado de campañas de marketing">
          {campaigns.map((campaign) => (
            <tr key={campaign.id}>
              <td className="marketing-page__cell">
                <div className="marketing-page__name-cell">
                  <span className="marketing-page__name">{campaign.name}</span>
                  {campaign.description && <span className="marketing-page__description">{campaign.description}</span>}
                </div>
              </td>
              <td className="marketing-page__cell">
                <span className="marketing-page__dates">{formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}</span>
              </td>
              <td className="marketing-page__cell">
                <Badge variant={statusVariant(campaign.status)}>{statusLabel(campaign.status)}</Badge>
              </td>
              <td className="marketing-page__cell marketing-page__cell--right">
                <Button variant="secondary" size="sm" onClick={() => { setSelectedCampaign(campaign); setDrawerOpen(true) }} aria-label={`Ver campaña ${campaign.name}`}>
                  Ver detalle
                </Button>
              </td>
            </tr>
          ))}
        </Table>
        <Pagination
          currentPage={page}
          hasNext={hasNext}
          onPageChange={(next) => { setLoadState('loading'); setPage(next) }}
          isLoading={false}
          itemsCount={campaigns.length}
          itemLabel="campaña"
          itemLabelPlural="campañas"
        />
      </>
    )
  }

  return (
    <div className="marketing-page">
      <PageHeader
        title="Marketing"
        description={`${metrics.total} campañas registradas · Seguimiento comercial por tenant`}
        badgeText="Módulo operativo · Campañas y contactos"
        searchPlaceholder="Buscar por nombre o descripción..."
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        actions={<Button variant="primary" className="marketing-page__header-btn--primary" onClick={() => { setSelectedCampaign(null); setDrawerOpen(true) }}>+ Nueva campaña</Button>}
        footer={<FilterTabs tabs={tabs} activeTab={statusFilter} onTabChange={handleStatusChange} ariaLabel="Filtro por estado de campaña" />}
      />

      {notice && <div role="status" className="marketing-page__status-banner">{notice}</div>}

      <section className="marketing-page__metrics" aria-label="Métricas de marketing">
        <MetricCard title="Campañas" value={metricsLoading ? '...' : metrics.total} subtitle="Registradas en la organización" iconVariant="primary" icon={<svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" /></svg>} />
        <MetricCard title="Activas" value={metricsLoading ? '...' : metrics.active} subtitle="Campañas en ejecución" iconVariant="success" icon={<svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-2 14.5v-9l6 4.5-6 4.5z" /></svg>} />
        <MetricCard title="Contactos" value={metricsLoading ? '...' : metrics.contacts} subtitle="Contactos únicos en campañas" iconVariant="neutral" icon={<svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>} />
        <MetricCard title="Envíos del día" value={metricsLoading ? '...' : `${metrics.sentToday}/20`} subtitle="Límite diario por tenant" iconVariant="warning" icon={<svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>} />
      </section>

      {content}

      <CampaignDrawer
        key={selectedCampaign?.id ?? `new-${drawerOpen}`}
        isOpen={drawerOpen}
        campaign={selectedCampaign}
        repository={repo}
        onClose={() => { setDrawerOpen(false); setSelectedCampaign(null) }}
        onSaved={handleSaved}
      />
    </div>
  )
}
