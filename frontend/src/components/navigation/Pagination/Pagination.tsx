import './Pagination.css'

//SOLID: SRP — GESTIONA LA NAVEGACIÓN PAGINADA ACCESIBLE BASADA EN PÁGINA ACTUAL Y SIGUIENTE DISPONIBLE.

export interface PaginationProps {
  currentPage: number // Base 0
  hasNext: boolean
  onPageChange: (page: number) => void
  isLoading?: boolean
}

export function Pagination({
  currentPage,
  hasNext,
  onPageChange,
  isLoading = false,
}: PaginationProps) {
  const isPreviousDisabled = currentPage <= 0 || isLoading
  const isNextDisabled = !hasNext || isLoading

  return (
    <nav className="pagination" aria-label="Navegación de páginas">
      <button
        type="button"
        className="pagination__button"
        disabled={isPreviousDisabled}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Ir a página anterior"
      >
        <span aria-hidden="true">&larr;</span>
        <span>Anterior</span>
      </button>

      <span className="pagination__status" aria-current="page">
        Página {currentPage + 1}
      </span>

      <button
        type="button"
        className="pagination__button"
        disabled={isNextDisabled}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Ir a página siguiente"
      >
        <span>Siguiente</span>
        <span aria-hidden="true">&rarr;</span>
      </button>
    </nav>
  )
}
