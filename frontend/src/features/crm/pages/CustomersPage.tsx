// SOLID: SRP — ESTA PÁGINA SE ENCARGA EXCLUSIVAMENTE DE LA VISUALIZACIÓN Y GESTIÓN DE CLIENTES.

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { PageHeader } from '../../../components/navigation'
import { Table } from '../../../components/ui/Table'
import { Pagination } from '../../../components/navigation/Pagination'
import { Button, Badge } from '../../../components/ui'
import { Spinner, Alert, EmptyState } from '../../../components/feedback'
import { CustomerDrawer } from '../components/CustomerDrawer'
import { CustomerDetailDrawer } from '../components/CustomerDetailDrawer'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CustomerActionsMenu } from '../components/CustomerActionsMenu'
import { CustomerApiError, getCustomerRepository, type CustomerRepository } from '../services'
import type { CustomerFilters, CustomerMetrics, CustomerStatus, CustomerView } from '../types/customer'
import './CustomersPage.css'

const COLUMNS = [
  { key: 'customer', label: 'Cliente' },
  { key: 'cedula', label: 'Identificación' },
  { key: 'contact', label: 'Contacto' },
  { key: 'status', label: 'Estado' },
  { key: 'actions', label: 'Acciones', align: 'right' as const },
]

type LoadState = 'idle' | 'loading' | 'success' | 'error' | 'forbidden'

export interface CustomersPageProps {
  /** Permite inyectar un repositorio en las pruebas. */
  repository?: CustomerRepository
}

// Helper para extraer iniciales de persona natural
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'CL'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function CustomersPage({ repository }: CustomersPageProps) {
  const repo = repository ?? getCustomerRepository()

  const [customers, setCustomers] = useState<CustomerView[]>([])
  const [page, setPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | ''>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [customerToEdit, setCustomerToEdit] = useState<CustomerView | null>(null)
  const [customerToView, setCustomerToView] = useState<CustomerView | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Métricas opcionales: solo se cargan si repo.getMetrics existe (modo simulado)
  const [metrics, setMetrics] = useState<CustomerMetrics | null>(null)

  // Estado para la confirmación accesible de activación/desactivación
  const [customerToToggle, setCustomerToToggle] = useState<CustomerView | null>(null)
  const toggleTriggerRef = useRef<HTMLElement | null>(null)

  // Estado para la confirmación accesible de archivado
  const [customerToArchive, setCustomerToArchive] = useState<CustomerView | null>(null)
  const archiveTriggerRef = useRef<HTMLElement | null>(null)

  // ID incremental por petición: la respuesta solo se aplica si su ID coincide
  // con el último emitido, descartando únicamente peticiones ANTERIORES.
  const currentRequestId = useRef(0)

  //SOLID: SRP — CARGA LA PÁGINA DE CLIENTES APLICANDO LOS FILTROS ACTIVOS.
  const loadPage = useCallback(
    async (p: number, currentSearch: string, currentStatus: CustomerStatus | '') => {
      currentRequestId.current += 1
      const thisRequest = currentRequestId.current

      setLoadState('loading')
      setErrorMessage(null)
      setActionError(null)

      const filters: CustomerFilters = {}
      if (currentSearch) filters.search = currentSearch
      if (currentStatus) filters.status = currentStatus

      try {
        const result = await repo.list(filters, p)
        // Descarta únicamente respuestas de peticiones anteriores, nunca la vigente.
        if (currentRequestId.current !== thisRequest) return
        setCustomers(result.items)
        setHasNext(result.hasNext)
        setPage(p)
        setLoadState('success')
      } catch (err) {
        if (currentRequestId.current !== thisRequest) return
        if (err instanceof CustomerApiError && err.kind === 'forbidden') {
          setLoadState('forbidden')
        } else {
          setLoadState('error')
          setErrorMessage('No se pudo cargar la lista de clientes.')
        }
      }
    },
    // repo es estable en el ciclo de vida del componente
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repo],
  )

  // Carga inicial y cada vez que cambian filtros o página.
  useEffect(() => {
    void loadPage(page, search, statusFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter])

  // Carga métricas únicamente si el método getMetrics existe en el repositorio (simulado)
  const loadMetrics = useCallback(async () => {
    if (typeof repo.getMetrics === 'function') {
      try {
        const m = await repo.getMetrics()
        setMetrics(m)
      } catch {
        // En caso de fallo en métricas simuladas, se omiten las tarjetas sin bloquear la lista
        setMetrics(null)
      }
    } else {
      setMetrics(null)
    }
  }, [repo])

  useEffect(() => {
    void loadMetrics()
  }, [loadMetrics])

  // Debounce de búsqueda (300 ms)
  function handleSearchInput(value: string) {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(value)
      setPage(0)
    }, 300)
  }

  function handleStatusTab(value: CustomerStatus | '') {
    setStatusFilter(value)
    setPage(0)
  }

  function handlePageChange(newPage: number) {
    setPage(newPage)
  }

  // Abre el diálogo de confirmación accesible guardando el cliente y la referencia al elemento disparador.
  function handleRequestToggle(customer: CustomerView, triggerEl?: HTMLElement | null) {
    if (triggerEl) toggleTriggerRef.current = triggerEl
    setCustomerToToggle(customer)
  }

  //SOLID: SRP — CAMBIA EL ESTADO DE UN CLIENTE TRAS LA CONFIRMACIÓN ACCESIBLE.
  async function handleConfirmToggle() {
    if (!customerToToggle) return
    const customer = customerToToggle
    setCustomerToToggle(null)

    const nextStatus: CustomerStatus = customer.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setActionError(null)
    try {
      const updated = await repo.setStatus(customer.id, nextStatus)
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      void loadMetrics()
    } catch (err) {
      if (err instanceof CustomerApiError && err.kind === 'forbidden') {
        setActionError('No tienes permiso para cambiar el estado del cliente.')
      } else {
        setActionError('No se pudo cambiar el estado. Inténtalo de nuevo.')
      }
    }
  }

  function handleCancelToggle() {
    setCustomerToToggle(null)
  }

  // Abre el diálogo de confirmación accesible de archivado
  function handleRequestArchive(customer: CustomerView, triggerEl?: HTMLElement | null) {
    if (triggerEl) archiveTriggerRef.current = triggerEl
    setCustomerToArchive(customer)
  }

  //SOLID: SRP — ARCHIVA EL CLIENTE TRAS LA CONFIRMACIÓN ACCESIBLE.
  async function handleConfirmArchive() {
    if (!customerToArchive) return
    const customer = customerToArchive
    setCustomerToArchive(null)

    setActionError(null)
    try {
      if (!repo.archive) {
        throw new CustomerApiError('Operación no soportada.', 'unknown')
      }
      await repo.archive(customer.id)
      setCustomers((prev) => prev.filter((c) => c.id !== customer.id))
      void loadMetrics()
    } catch (err) {
      if (err instanceof CustomerApiError && err.kind === 'forbidden') {
        setActionError('No tienes permiso para archivar clientes.')
      } else {
        setActionError('No se pudo archivar el cliente. Inténtalo de nuevo.')
      }
    }
  }

  function handleCancelArchive() {
    setCustomerToArchive(null)
  }

  function handleCreated() {
    // Recarga desde la primera página para mostrar el nuevo cliente
    setPage(0)
    void loadPage(0, search, statusFilter)
    void loadMetrics()
  }

  function handleViewDetail(customer: CustomerView) {
    setCustomerToView(customer)
  }

  function handleEdit(customer: CustomerView) {
    setCustomerToEdit(customer)
    setDrawerOpen(true)
  }

  function handleUpdated(updated: CustomerView) {
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    void loadMetrics()
  }

  function handleCloseDrawer() {
    setDrawerOpen(false)
    setCustomerToEdit(null)
  }

  // ── Renderizado según estado ──

  let content: ReactNode

  if (loadState === 'loading') {
    content = (
      <div className="customers-page__loading">
        <Spinner size="lg" label="Cargando clientes..." />
      </div>
    )
  } else if (loadState === 'forbidden') {
    content = (
      <Alert variant="error" title="Acceso denegado">
        No tienes permiso para ver clientes.
      </Alert>
    )
  } else if (loadState === 'error') {
    content = (
      <Alert variant="error" title="Error al cargar">
        {errorMessage}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void loadPage(page, search, statusFilter)}
        >
          Reintentar
        </Button>
      </Alert>
    )
  } else if (loadState === 'success' && customers.length === 0) {
    content = (
      <EmptyState
        title="Sin clientes"
        description="No se encontraron clientes con los filtros seleccionados."
        action={
          <Button
            variant="primary"
            onClick={() => {
              setCustomerToEdit(null)
              setDrawerOpen(true)
            }}
          >
            + Nuevo cliente
          </Button>
        }
      />
    )
  } else {
    content = (
      <>
        <Table columns={COLUMNS} ariaLabel="Lista de clientes">
          {customers.map((c) => (
            <tr key={c.id} className="customers-page__row">
              <td className="customers-page__cell">
                <div className="customers-page__customer-cell">
                  <div className="customers-page__avatar" aria-hidden="true">
                    {getInitials(c.fullName)}
                  </div>
                  <div className="customers-page__name-wrapper">
                    <span className="customers-page__name">{c.fullName}</span>
                  </div>
                </div>
              </td>
              <td className="customers-page__cell">
                <div className="customers-page__id-cell">
                  <span className="customers-page__id-number">{c.cedula ?? '—'}</span>
                  {c.cedula && <span className="customers-page__id-label">Cédula</span>}
                </div>
              </td>
              <td className="customers-page__cell">
                <div className="customers-page__contact-cell">
                  <span className="customers-page__contact-primary">{c.email ?? '—'}</span>
                  <span className="customers-page__contact-secondary">{c.phone ?? '—'}</span>
                </div>
              </td>
              <td className="customers-page__cell">
                <Badge variant={c.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {c.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                </Badge>
              </td>
              <td className="customers-page__cell customers-page__cell--right">
                <CustomerActionsMenu
                  customer={c}
                  onToggleStatus={(customer) => handleRequestToggle(customer)}
                  onViewDetail={handleViewDetail}
                  onEdit={handleEdit}
                  onArchive={(customer) => handleRequestArchive(customer)}
                />
              </td>
            </tr>
          ))}
        </Table>

        <Pagination
          currentPage={page}
          hasNext={hasNext}
          onPageChange={handlePageChange}
          itemsCount={customers.length}
        />
      </>
    )
  }

  // Footer con pestañas tipo píldora (Stitch)
  const headerFooter = (
    <div className="customers-page__tabs" role="tablist" aria-label="Filtro de clientes por estado">
      <button
        type="button"
        role="tab"
        aria-selected={statusFilter === ''}
        className={`customers-page__tab-pill${statusFilter === '' ? ' customers-page__tab-pill--active' : ''}`}
        onClick={() => handleStatusTab('')}
      >
        <span>Todos</span>
        {metrics && <span className="customers-page__tab-badge">{metrics.totalClientes}</span>}
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={statusFilter === 'ACTIVE'}
        className={`customers-page__tab-pill${statusFilter === 'ACTIVE' ? ' customers-page__tab-pill--active' : ''}`}
        onClick={() => handleStatusTab('ACTIVE')}
      >
        <span>Activos</span>
        {metrics && <span className="customers-page__tab-badge">{metrics.activos}</span>}
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={statusFilter === 'INACTIVE'}
        className={`customers-page__tab-pill${statusFilter === 'INACTIVE' ? ' customers-page__tab-pill--active' : ''}`}
        onClick={() => handleStatusTab('INACTIVE')}
      >
        <span>Inactivos</span>
        {metrics && <span className="customers-page__tab-badge">{metrics.inactivos}</span>}
      </button>
    </div>
  )

  return (
    <div className="customers-page">
      <PageHeader
        title="Clientes"
        description="Administración centralizada de cuentas de personas naturales y estados de cartera comercial."
        searchPlaceholder="Buscar por nombre, cédula o correo..."
        searchValue={searchInput}
        onSearchChange={handleSearchInput}
        badgeText="Módulo Comercial • Directorio General"
        actions={
          <>
            <button
              type="button"
              className="btn customers-page__header-btn--export"
              disabled
              aria-disabled="true"
              title="Exportación próximamente disponible"
            >
              Exportar
            </button>
            <Button
              variant="primary"
              onClick={() => {
                setCustomerToEdit(null)
                setDrawerOpen(true)
              }}
              className="customers-page__header-btn--primary"
            >
              + Nuevo cliente
            </Button>
          </>
        }
        footer={headerFooter}
      />

      {/* Resumen métrico rápido Stitch — SOLO visible con datos simulados (si metrics !== null) */}
      {metrics && (
        <section className="customers-page__metrics" aria-label="Resumen de cartera">
          <div className="customers-page__metric-card">
            <div>
              <p className="customers-page__metric-label">Total Clientes</p>
              <p className="customers-page__metric-value">{metrics.totalClientes}</p>
            </div>
            <div className="customers-page__metric-icon customers-page__metric-icon--primary" aria-hidden="true">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
            </div>
          </div>

          <div className="customers-page__metric-card">
            <div>
              <p className="customers-page__metric-label">Clientes Activos</p>
              <p className="customers-page__metric-value">{metrics.activos}</p>
            </div>
            <div className="customers-page__metric-icon customers-page__metric-icon--success" aria-hidden="true">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
          </div>

          <div className="customers-page__metric-card">
            <div>
              <p className="customers-page__metric-label">Clientes Inactivos</p>
              <p className="customers-page__metric-value">{metrics.inactivos}</p>
            </div>
            <div className="customers-page__metric-icon customers-page__metric-icon--neutral" aria-hidden="true">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            </div>
          </div>

          <div className="customers-page__metric-card">
            <div>
              <p className="customers-page__metric-label">Nuevos este mes</p>
              <p className="customers-page__metric-value">{metrics.nuevosEsteMes}</p>
            </div>
            <div className="customers-page__metric-icon customers-page__metric-icon--info" aria-hidden="true">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
            </div>
          </div>
        </section>
      )}

      {actionError && (
        <Alert variant="error">{actionError}</Alert>
      )}

      <div className="customers-page__content">{content}</div>

      <CustomerDrawer
        isOpen={drawerOpen}
        onClose={handleCloseDrawer}
        repository={repo}
        onCreated={handleCreated}
        customerToEdit={customerToEdit}
        onUpdated={handleUpdated}
      />

      <CustomerDetailDrawer
        isOpen={customerToView !== null}
        customer={customerToView}
        onClose={() => setCustomerToView(null)}
        onEdit={(c) => {
          setCustomerToView(null)
          handleEdit(c)
        }}
      />

      <ConfirmDialog
        isOpen={customerToToggle !== null}
        title={
          customerToToggle?.status === 'ACTIVE'
            ? 'Desactivar cliente'
            : 'Activar cliente'
        }
        description={
          customerToToggle
            ? `¿Deseas ${
                customerToToggle.status === 'ACTIVE' ? 'desactivar' : 'activar'
              } a "${customerToToggle.fullName}"?`
            : ''
        }
        confirmLabel={
          customerToToggle?.status === 'ACTIVE' ? 'Desactivar' : 'Activar'
        }
        cancelLabel="Cancelar"
        onConfirm={handleConfirmToggle}
        onCancel={handleCancelToggle}
        triggerRef={toggleTriggerRef}
      />

      <ConfirmDialog
        isOpen={customerToArchive !== null}
        title="Archivar cliente"
        description={
          customerToArchive
            ? `¿Estás seguro de archivar a "${customerToArchive.fullName}"? El cliente será retirado del directorio activo.`
            : ''
        }
        confirmLabel="Archivar"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmArchive}
        onCancel={handleCancelArchive}
        triggerRef={archiveTriggerRef}
      />
    </div>
  )
}
