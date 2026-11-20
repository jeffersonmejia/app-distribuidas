import './Pagination.css'

//SOLID: SRP — GESTIONA LA NAVEGACIÓN PAGINADA ACCESIBLE BASADA EN PÁGINA ACTUAL Y SIGUIENTE DISPONIBLE.

export interface PaginationProps {
  currentPage: number // Base 0
  hasNext: boolean
  onPageChange: (page: number) => void
  isLoading?: boolean
  itemsCount?: number
}

export function Pagination({
  currentPage,
  hasNext,
  onPageChange,
  isLoading = false,
  itemsCount,
}: PaginationProps) {
  const isPreviousDisabled = currentPage <= 0 || isLoading
  const isNextDisabled = !hasNext || isLoading

  return (
    <nav className="pagination" aria-label="Navegación de páginas">
      <div className="pagination__summary">
        {itemsCount !== undefined ? (
          <span>
            Mostrando <strong>{itemsCount}</strong> clientes (Página {currentPage + 1})
          </span>
        ) : (
          <span>Página {currentPage + 1}</span>
        )}
      </div>

      <div className="pagination__controls">
        <button
          type="button"
          className="pagination__button pagination__button--nav"
          disabled={isPreviousDisabled}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Ir a página anterior"
        >
          <span aria-hidden="true">&larr;</span>
          <span>Anterior</span>
        </button>

        <span className="pagination__page-badge" aria-current="page">
          {currentPage + 1}
        </span>

        <button
          type="button"
          className="pagination__button pagination__button--nav"
          disabled={isNextDisabled}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Ir a página siguiente"
        >
          <span>Siguiente</span>
          <span aria-hidden="true">&rarr;</span>
        </button>
      </div>
    </nav>
  )
}
