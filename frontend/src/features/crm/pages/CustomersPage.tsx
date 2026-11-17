// SOLID: SRP — ESTA PÁGINA SE ENCARGA EXCLUSIVAMENTE DE LA VISUALIZACIÓN Y GESTIÓN DE CLIENTES.

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { PageHeader } from '../../../components/navigation'
import { Table } from '../../../components/ui/Table'
import { Pagination } from '../../../components/navigation/Pagination'
import { Button, Badge } from '../../../components/ui'
import { Spinner, Alert, EmptyState } from '../../../components/feedback'
import { Select } from '../../../components/forms'
import { CustomerDrawer } from '../components/CustomerDrawer'
import { CustomerApiError, getCustomerRepository, type CustomerRepository } from '../services'
import type { CustomerFilters, CustomerStatus, CustomerView } from '../types/customer'

// Contador global de peticiones para identificar cuál es la vigente y descartar
// únicamente las anteriores (evita la condición de carrera sin cancelar la petición activa).
let requestCounter = 0

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' },
]

const COLUMNS = [
  { key: 'fullName', label: 'Nombre' },
  { key: 'cedula', label: 'Cédula' },
  { key: 'email', label: 'Correo' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'status', label: 'Estado' },
  { key: 'actions', label: 'Acciones', align: 'right' as const },
]

type LoadState = 'idle' | 'loading' | 'success' | 'error' | 'forbidden'

export interface CustomersPageProps {
  /** Permite inyectar un repositorio en las pruebas. */
  repository?: CustomerRepository
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
  const [actionError, setActionError] = useState<string | null>(null)

  // ID incremental por petición: la respuesta solo se aplica si su ID coincide
  // con el último emitido, descartando únicamente peticiones ANTERIORES.
  const currentRequestId = useRef(0)

  //SOLID: SRP — CARGA LA PÁGINA DE CLIENTES APLICANDO LOS FILTROS ACTIVOS.
  const loadPage = useCallback(
    async (p: number, currentSearch: string, currentStatus: CustomerStatus | '') => {
      requestCounter += 1
      const thisRequest = requestCounter
      currentRequestId.current = thisRequest

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repo],
  )

  // Carga inicial y cada vez que cambian filtros o página.
  // El cleanup NO marca la petición como cancelada: solo invalida peticiones
  // anteriores a través del ID incremental en loadPage.
  useEffect(() => {
    void loadPage(page, search, statusFilter)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter])

  // Debounce de búsqueda (300 ms)
  function handleSearchInput(value: string) {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(value)
      setPage(0)
    }, 300)
  }

  function handleStatusFilter(value: string) {
    setStatusFilter(value as CustomerStatus | '')
    setPage(0)
  }

  function handlePageChange(newPage: number) {
    setPage(newPage)
  }

  //SOLID: SRP — CAMBIA EL ESTADO DE UN CLIENTE MOSTRANDO CONFIRMACIÓN ACCESIBLE.
  async function handleToggleStatus(customer: CustomerView) {
    const nextStatus: CustomerStatus = customer.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    const label = nextStatus === 'INACTIVE' ? 'desactivar' : 'activar'
    const confirmed = window.confirm(
      `¿Deseas ${label} a "${customer.fullName}"?`,
    )
    if (!confirmed) return

    setActionError(null)
    try {
      const updated = await repo.setStatus(customer.id, nextStatus)
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    } catch (err) {
      if (err instanceof CustomerApiError && err.kind === 'forbidden') {
        setActionError('No tienes permiso para cambiar el estado del cliente.')
      } else {
        setActionError('No se pudo cambiar el estado. Inténtalo de nuevo.')
      }
    }
  }

  function handleCreated() {
    // Recarga desde la primera página para mostrar el nuevo cliente
    setPage(0)
    void loadPage(0, search, statusFilter)
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
          <Button variant="primary" onClick={() => setDrawerOpen(true)}>
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
              <td className="customers-page__cell">{c.fullName}</td>
              <td className="customers-page__cell">{c.cedula ?? '—'}</td>
              <td className="customers-page__cell">{c.email ?? '—'}</td>
              <td className="customers-page__cell">{c.phone ?? '—'}</td>
              <td className="customers-page__cell">
                <Badge variant={c.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {c.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                </Badge>
              </td>
              <td className="customers-page__cell customers-page__cell--right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleToggleStatus(c)}
                  aria-label={
                    c.status === 'ACTIVE'
                      ? `Desactivar ${c.fullName}`
                      : `Activar ${c.fullName}`
                  }
                >
                  {c.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                </Button>
              </td>
            </tr>
          ))}
        </Table>

        <Pagination
          currentPage={page}
          hasNext={hasNext}
          onPageChange={handlePageChange}
          isLoading={loadState === 'loading'}
        />
      </>
    )
  }

  return (
    <div className="customers-page">
      <PageHeader
        title="Clientes"
        description="Cartera comercial activa y seguimiento de cuentas."
        searchPlaceholder="Buscar por nombre, cédula o correo..."
        searchValue={searchInput}
        onSearchChange={handleSearchInput}
        actions={
          <Button variant="primary" onClick={() => setDrawerOpen(true)}>
            + Nuevo cliente
          </Button>
        }
      />

      <div className="customers-page__toolbar">
        <Select
          id="customers-status-filter"
          label="Estado"
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(e) => handleStatusFilter(e.target.value)}
        />
      </div>

      {actionError && (
        <Alert variant="error">{actionError}</Alert>
      )}

      <div className="customers-page__content">{content}</div>

      <CustomerDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        repository={repo}
        onCreated={handleCreated}
      />
    </div>
  )
}
