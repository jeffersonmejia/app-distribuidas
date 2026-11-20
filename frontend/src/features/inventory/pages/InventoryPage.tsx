// SOLID: SRP — ESTA PÁGINA SE ENCARGA EXCLUSIVAMENTE DE LA VISUALIZACIÓN Y GESTIÓN DEL CATÁLOGO DE INVENTARIO.

import { useState, useEffect, useRef, type ReactNode } from 'react'
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

// SOLID: SRP — DEVUELVE EL ICONO REPRESENTATIVO SEGÚN LA CATEGORÍA DEL PRODUCTO.
function getProductCategoryIcon(category: ProductCategory) {
  switch (category) {
    case 'Materiales':
      return (
        <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3L2 8l10 5 10-5-10-5zm0 8.7L4.5 8 12 4.3 19.5 8 12 11.7zM2 13.5l10 5 10-5v2l-10 5-10-5v-2zm0-4.5l10 5 10-5v2l-10 5-10-5v-2z" />
        </svg>
      )
    case 'Equipos':
      return (
        <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16v10H4V6zm18-2H2c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-3v-2h7c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 10h-4v-2h4v2z" />
        </svg>
      )
    case 'Herramientas':
      return (
        <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.6C.4 7.1.9 10 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
        </svg>
      )
    case 'Repuestos':
      return (
        <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
        </svg>
      )
    case 'Servicios':
      return (
        <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
        </svg>
      )
  }
}

export function InventoryPage({ repository }: InventoryPageProps) {
  const repo = repository ?? getInventoryRepository()

  const [products, setProducts] = useState<Product[]>([])
  const [page, setPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | ''>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [metrics, setMetrics] = useState<InventoryMetrics | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerKey, setDrawerKey] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false

    repo
      .list(
        {
          search: search || undefined,
          category: categoryFilter || undefined,
        },
        page
      )
      .then((res) => {
        if (!ignore) {
          setProducts(res.items)
          setHasNext(res.hasNext)
          setErrorMessage(null)
          setLoadState('success')
        }
      })
      .catch((err) => {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'No se pudo cargar el inventario.'
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
  }, [repo, page, search, categoryFilter, reloadKey])

  // PageHeader pasa el valor de búsqueda como string, no como ChangeEvent.
  function handleSearchInput(val: string) {
    setSearchInput(val)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setLoadState('loading')
      setSearch(val)
      setPage(0)
    }, 300)
  }

  function handleCategoryTab(cat: ProductCategory | '') {
    setLoadState('loading')
    setCategoryFilter(cat)
    setPage(0)
  }

  function handlePageChange(newPage: number) {
    setLoadState('loading')
    setPage(newPage)
  }

  function handleOpenCreate() {
    setDrawerKey((prev) => prev + 1)
    setDrawerOpen(true)
  }

  function handleProductCreated(newPrd: Product) {
    setSuccessNotice(`Producto "${newPrd.name}" registrado con éxito.`)
    setLoadState('loading')
    setPage(0)
    setReloadKey((prev) => prev + 1)
  }

  const categoryTabs = [
    { id: '' as const, label: 'Todos', count: metrics ? metrics.totalProducts : undefined },
    {
      id: 'Materiales' as const,
      label: 'Materiales',
      count: metrics?.categoryCounts ? metrics.categoryCounts.Materiales : undefined,
    },
    {
      id: 'Equipos' as const,
      label: 'Equipos',
      count: metrics?.categoryCounts ? metrics.categoryCounts.Equipos : undefined,
    },
    {
      id: 'Herramientas' as const,
      label: 'Herramientas',
      count: metrics?.categoryCounts ? metrics.categoryCounts.Herramientas : undefined,
    },
    {
      id: 'Repuestos' as const,
      label: 'Repuestos',
      count: metrics?.categoryCounts ? metrics.categoryCounts.Repuestos : undefined,
    },
    {
      id: 'Servicios' as const,
      label: 'Servicios',
      count: metrics?.categoryCounts ? metrics.categoryCounts.Servicios : undefined,
    },
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
          onClick={() => {
            setLoadState('loading')
            setErrorMessage(null)
            setReloadKey((prev) => prev + 1)
          }}
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
        action={
          search || categoryFilter ? undefined : (
            <Button variant="primary" onClick={handleOpenCreate}>
              + Nuevo producto
            </Button>
          )
        }
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
                      {getProductCategoryIcon(p.category)}
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
          itemLabel="producto"
          itemLabelPlural="productos"
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
            subtitle={
              metrics.activeCategoryCount !== undefined
                ? `En ${metrics.activeCategoryCount} categorías activas`
                : 'En categorías activas'
            }
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
            subtitle={
              metrics.lowStockCount === 1
                ? '1 ítem crítico'
                : `${metrics.lowStockCount} ítems críticos`
            }
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
