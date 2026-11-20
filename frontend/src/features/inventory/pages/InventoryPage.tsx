// SOLID: SRP — ESTA PÁGINA SE ENCARGA EXCLUSIVAMENTE DE LA VISUALIZACIÓN Y GESTIÓN DEL CATÁLOGO DE INVENTARIO.

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { PageHeader } from '../../../components/navigation'
import { Table } from '../../../components/ui/Table'
import { Pagination } from '../../../components/navigation/Pagination'
import { Button, Badge, MetricCard, FilterTabs } from '../../../components/ui'
import { Spinner, Alert, EmptyState } from '../../../components/feedback'
import { ProductDrawer } from '../components/ProductDrawer'
import { ProductActionsMenu } from '../components/ProductActionsMenu'
import { getInventoryRepository, type InventoryRepository } from '../services'
import type { Product, ProductCategory, InventoryMetrics } from '../types/product'
import { formatMoney } from '../utils/formatters'
import './InventoryPage.css'

const COLUMNS = [
  { key: 'product', label: 'Producto & SKU' },
  { key: 'category', label: 'Categoría' },
  { key: 'stock', label: 'Nivel de Stock' },
  { key: 'price', label: 'Precio Unitario' },
  { key: 'status', label: 'Estado' },
  { key: 'actions', label: 'Acciones', align: 'right' as const },
]

type LoadState = 'idle' | 'loading' | 'success' | 'error'

export interface InventoryPageProps {
  repository?: InventoryRepository
}

export function InventoryPage({ repository }: InventoryPageProps) {
  const repo = repository ?? getInventoryRepository()

  const [products, setProducts] = useState<Product[]>([])
  const [page, setPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | ''>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [metrics, setMetrics] = useState<InventoryMetrics | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerKey, setDrawerKey] = useState(0)

  const currentRequestId = useRef(0)

  const loadPage = useCallback(
    async (p: number, currentSearch: string, currentCategory: ProductCategory | '') => {
      currentRequestId.current += 1
      const thisRequest = currentRequestId.current

      setLoadState('loading')
      setErrorMessage(null)

      try {
        const res = await repo.list(
          {
            search: currentSearch || undefined,
            category: currentCategory || undefined,
          },
          p
        )

        if (thisRequest === currentRequestId.current) {
          setProducts(res.items)
          setHasNext(res.hasNext)
          setLoadState('success')
        }
      } catch (err) {
        if (thisRequest === currentRequestId.current) {
          const msg = err instanceof Error ? err.message : 'No se pudo cargar el inventario.'
          setErrorMessage(msg)
          setLoadState('error')
        }
      }
    },
    [repo]
  )

  const loadMetrics = useCallback(async () => {
    if (!repo.getMetrics) return
    try {
      const data = await repo.getMetrics()
      setMetrics(data)
    } catch {
      // Si falla métricas, no bloquea el listado
    }
  }, [repo])

  useEffect(() => {
    void loadPage(page, search, categoryFilter)
    void loadMetrics()
  }, [loadPage, loadMetrics, page, search, categoryFilter])

  function handleSearchInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setSearchInput(val)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(val)
      setPage(0)
    }, 300)
  }

  function handleCategoryTab(cat: ProductCategory | '') {
    setCategoryFilter(cat)
    setPage(0)
  }

  function handlePageChange(newPage: number) {
    setPage(newPage)
  }

  function handleOpenCreate() {
    setDrawerKey((prev) => prev + 1)
    setDrawerOpen(true)
  }

  function handleProductCreated(newPrd: Product) {
    setSuccessNotice(`Producto "${newPrd.name}" registrado con éxito.`)
    setPage(0)
    void loadPage(0, search, categoryFilter)
    void loadMetrics()
  }

  const categoryTabs = [
    { id: '' as const, label: 'Todos' },
    { id: 'Materiales' as const, label: 'Materiales' },
    { id: 'Equipos' as const, label: 'Equipos' },
    { id: 'Herramientas' as const, label: 'Herramientas' },
    { id: 'Repuestos' as const, label: 'Repuestos' },
    { id: 'Servicios' as const, label: 'Servicios' },
  ]

  const headerFooter = (
    <FilterTabs
      tabs={categoryTabs}
      activeTab={categoryFilter}
      onTabChange={(id) => handleCategoryTab(id as ProductCategory | '')}
      ariaLabel="Filtro de productos por categoría"
    />
  )

  let content: ReactNode

  if (loadState === 'loading') {
    content = (
      <div className="inventory-page__loading">
        <Spinner size="lg" label="Cargando catálogo de inventario..." />
      </div>
    )
  } else if (loadState === 'error') {
    content = (
      <Alert variant="error" title="Error al cargar inventario">
        <p>{errorMessage}</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void loadPage(page, search, categoryFilter)}
        >
          Reintentar
        </Button>
      </Alert>
    )
  } else if (products.length === 0) {
    content = (
      <EmptyState
        title="Sin productos en catálogo"
        description={
          search || categoryFilter
            ? 'No se encontraron artículos con los filtros aplicados.'
            : 'No hay productos registrados en esta organización.'
        }
        actionLabel={search || categoryFilter ? undefined : '+ Nuevo producto'}
        onAction={search || categoryFilter ? undefined : handleOpenCreate}
      />
    )
  } else {
    content = (
      <>
        <Table columns={COLUMNS} caption="Catálogo de productos y existencias de bodega">
          {products.map((p) => {
            const isLow = p.status === 'low'
            const pct = p.minStock > 0 ? Math.min(100, Math.round((p.stock / (p.minStock * 2)) * 100)) : 100
            return (
              <tr key={p.id} className="inventory-page__row">
                <td className="inventory-page__cell">
                  <div className="inventory-page__product-cell">
                    <div className="inventory-page__product-icon" aria-hidden="true">
                      <svg fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v3.01c0 .72.38 1.36.95 1.7L3 9.7V20c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9.7l.05-.99c.57-.34.95-.98.95-1.7V4c0-1.1-.9-2-2-2zM4 4h16v3H4V4zm15 16H5V10h14v10zm-9-8h4v2h-4v-2z" />
                      </svg>
                    </div>
                    <div className="inventory-page__product-info">
                      <span className="inventory-page__product-name">{p.name}</span>
                      <span className="inventory-page__product-sku">SKU: {p.sku}</span>
                    </div>
                  </div>
                </td>
                <td className="inventory-page__cell">
                  <span className="inventory-page__category-badge">{p.category}</span>
                </td>
                <td className="inventory-page__cell">
                  <div className="inventory-page__stock-cell">
                    <div className="inventory-page__stock-meta">
                      <span className={`inventory-page__stock-current${isLow ? ' inventory-page__stock-current--low' : ''}`}>
                        {p.stock} uds.
                      </span>
                      <span className="inventory-page__stock-min">mín. {p.minStock}</span>
                    </div>
                    <div className="inventory-page__progress-track" role="progressbar" aria-valuenow={p.stock} aria-valuemin={0} aria-valuemax={p.minStock * 2} aria-label={`Nivel de stock para ${p.name}`}>
                      <div
                        className={`inventory-page__progress-bar inventory-page__progress-bar--${p.status}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="inventory-page__cell">
                  <span className="inventory-page__price-amount">{formatMoney(p.sellingPriceCents)}</span>
                  <span className="inventory-page__price-currency">USD</span>
                </td>
                <td className="inventory-page__cell">
                  <Badge variant={isLow ? 'warning' : 'success'}>
                    {isLow ? 'Stock bajo' : 'Disponible'}
                  </Badge>
                </td>
                <td className="inventory-page__cell inventory-page__cell--right">
                  <ProductActionsMenu
                    product={p}
                    onViewAvailability={(product) => {
                      setSuccessNotice(`Disponibilidad de "${product.name}": ${product.stock} unidades libres.`)
                    }}
                  />
                </td>
              </tr>
            )
          })}
        </Table>

        <Pagination
          currentPage={page}
          hasNext={hasNext}
          onPageChange={handlePageChange}
          itemsCount={products.length}
        />
      </>
    )
  }

  return (
    <div className="inventory-page">
      <PageHeader
        title="Inventario"
        description={`${metrics?.totalProducts ?? products.length} productos registrados · Control de existencias y valorización en tiempo real`}
        searchPlaceholder="Buscar por nombre, SKU o categoría..."
        searchValue={searchInput}
        onSearchChange={handleSearchInput}
        badgeText="MÓDULO OPERATIVO • Sede Principal · Bodega Norte"
        actions={
          <>
            <button
              type="button"
              className="btn inventory-page__header-btn--filters"
              disabled
              aria-disabled="true"
              title="Filtros avanzados próximamente"
            >
              Filtros avanzados
            </button>
            <button
              type="button"
              className="btn inventory-page__header-btn--export"
              disabled
              aria-disabled="true"
              title="Exportación próximamente disponible"
            >
              Exportar
            </button>
            <Button
              variant="primary"
              onClick={handleOpenCreate}
              className="inventory-page__header-btn--primary"
            >
              + Nuevo producto
            </Button>
          </>
        }
        footer={headerFooter}
      />

      {successNotice && (
        <div role="status" className="inventory-page__status-banner">
          {successNotice}
        </div>
      )}

      {metrics && (
        <section className="inventory-page__metrics" aria-label="Métricas de inventario">
          <MetricCard
            title="Total de productos"
            value={metrics.totalProducts}
            subtitle="En categorías activas"
            iconVariant="primary"
            icon={
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v3.01c0 .72.38 1.36.95 1.7L3 9.7V20c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9.7l.05-.99c.57-.34.95-.98.95-1.7V4c0-1.1-.9-2-2-2zM4 4h16v3H4V4zm15 16H5V10h14v10zm-9-8h4v2h-4v-2z" />
              </svg>
            }
          />

          <MetricCard
            title="Stock bajo"
            value={metrics.lowStockCount}
            subtitle="Requieren reposición inmediata"
            badge={<Badge variant="warning">Atención</Badge>}
            iconVariant="warning"
            icon={
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
              </svg>
            }
          />

          <MetricCard
            title="Valor del inventario"
            value={formatMoney(metrics.totalInventoryValueCents)}
            subtitle="Costo promedio ponderado"
            iconVariant="success"
            icon={
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
              </svg>
            }
          />
        </section>
      )}

      {content}

      <ProductDrawer
        key={drawerKey}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreated={handleProductCreated}
        repository={repo}
      />
    </div>
  )
}
