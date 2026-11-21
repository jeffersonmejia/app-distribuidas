// SOLID: SRP — MODAL ACCESIBLE PARA LA SELECCIÓN DE PRODUCTOS DESDE EL INVENTARIO.

import { useState, useEffect, useRef, useCallback, useId } from 'react'
import type { Product } from '../../../inventory/types/product'
import type { InventoryRepository } from '../../../inventory/services/inventoryRepository'
import { getInventoryRepository } from '../../../inventory/services'
import { formatMoney } from '../../../../utils/formatMoney'
import { Spinner } from '../../../../components/feedback/Spinner'
import { EmptyState } from '../../../../components/feedback/EmptyState'
import './ProductSelectModal.css'

export interface ProductSelectModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectProduct: (product: Product) => void
  selectedProductIds?: string[]
  inventoryRepository?: InventoryRepository
}

// SOLID: OCP — COMPONENTE MODAL EXTENSIBLE POR PROPS SIN ALTERAR SU LÓGICA INTERNA.
export function ProductSelectModal({
  isOpen,
  onClose,
  onSelectProduct,
  selectedProductIds = [],
  inventoryRepository,
}: ProductSelectModalProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [loadState, setLoadState] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  const titleId = useId()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  const handleClose = useCallback(() => {
    setSearch('')
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    let ignore = false

    Promise.resolve().then(() => {
      if (!ignore) {
        setLoadState('loading')
        setError(null)
      }
    })

    const repo = inventoryRepository ?? getInventoryRepository()

    repo
      .list({}, 0)
      .then((res) => {
        if (!ignore) {
          setProducts(res.items)
          setLoadState('success')
        }
      })
      .catch((err: Error) => {
        if (!ignore) {
          setError(err.message || 'Error al cargar productos del inventario.')
          setLoadState('error')
        }
      })

    return () => {
      ignore = true
    }
  }, [isOpen, inventoryRepository])

  // Foco inicial en el buscador
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  // Cierre con Escape y trampa de foco
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose()
        return
      }
      if (e.key !== 'Tab') return

      const modal = modalRef.current
      if (!modal) return
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled'))

      if (focusable.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose])

  // Bloqueo de scroll de fondo
  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const filtered = products.filter((p) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    )
  })

  return (
    <>
      <div className="product-select-modal-overlay" onClick={handleClose} aria-hidden="true" />
      <div className="product-select-modal-container">
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="product-select-modal"
        >
          <div className="product-select-modal__header">
            <div>
              <h2 id={titleId} className="product-select-modal__title">
                Seleccionar producto de inventario
              </h2>
              <p className="product-select-modal__subtitle">
                Busca y añade referencias con existencia disponible al comprobante
              </p>
            </div>
            <button
              type="button"
              className="product-select-modal__close-btn"
              onClick={handleClose}
              aria-label="Cerrar ventana de selección de producto"
            >
              ✕
            </button>
          </div>

          <div className="product-select-modal__search-box">
            <input
              ref={searchInputRef}
              type="text"
              className="product-select-modal__search-input"
              placeholder="Buscar por nombre, SKU o categoría..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar producto en el inventario"
            />
          </div>

          <div className="product-select-modal__body">
            {loadState === 'loading' ? (
              <div className="product-select-modal__loading">
                <Spinner />
                <span>Cargando catálogo de inventario...</span>
              </div>
            ) : loadState === 'error' && error ? (
              <div className="product-select-modal__error" role="alert">
                <span>{error}</span>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title="Sin productos coincidentes"
                description={
                  search
                    ? 'No se encontraron referencias para el criterio de búsqueda.'
                    : 'No hay productos disponibles en el catálogo de inventario.'
                }
              />
            ) : (
              <div className="product-select-modal__list" role="list">
                {filtered.map((product) => {
                  const isSelected = selectedProductIds.includes(product.id)
                  const isOutOfStock = product.stock <= 0

                  return (
                    <div
                      key={product.id}
                      className={`product-select-modal__item ${
                        isSelected ? 'product-select-modal__item--selected' : ''
                      } ${isOutOfStock ? 'product-select-modal__item--out-of-stock' : ''}`}
                      role="listitem"
                    >
                      <div className="product-select-modal__item-info">
                        <span className="product-select-modal__item-name">{product.name}</span>
                        <div className="product-select-modal__item-meta">
                          <span className="product-select-modal__item-sku">{product.sku}</span>
                          <span>•</span>
                          <span className="product-select-modal__item-category">
                            {product.category}
                          </span>
                          <span>•</span>
                          <span
                            className={`product-select-modal__item-stock ${
                              product.stock <= product.minStock
                                ? 'product-select-modal__item-stock--low'
                                : ''
                            }`}
                          >
                            Stock: {product.stock}
                          </span>
                        </div>
                      </div>

                      <div className="product-select-modal__item-action">
                        <span className="product-select-modal__item-price">
                          {formatMoney(product.sellingPriceCents)}
                        </span>
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          disabled={isOutOfStock}
                          onClick={() => {
                            onSelectProduct(product)
                            handleClose()
                          }}
                          aria-label={`Seleccionar ${product.name}`}
                        >
                          {isSelected ? 'Añadido (+)' : 'Agregar'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="product-select-modal__footer">
            <button type="button" className="btn btn--ghost btn--md" onClick={handleClose}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
