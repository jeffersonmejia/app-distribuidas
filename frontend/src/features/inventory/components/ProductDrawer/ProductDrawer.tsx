// SOLID: SRP — ESTE COMPONENTE GESTIONA EXCLUSIVAMENTE EL FORMULARIO DE ALTA DE PRODUCTOS EN EL PANEL LATERAL.

import { useState, type FormEvent } from 'react'
import { Drawer } from '../../../../components/ui/Drawer'
import { Input, Select } from '../../../../components/forms'
import { Button } from '../../../../components/ui'
import { Alert } from '../../../../components/feedback'
import { InventoryApiError, type InventoryRepository } from '../../services'
import type { Product, ProductCategory, ProductInput } from '../../types/product'
import './ProductDrawer.css'

export interface ProductDrawerProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (product: Product) => void
  repository: InventoryRepository
}

const CATEGORY_OPTIONS: { value: ProductCategory; label: string }[] = [
  { value: 'Materiales', label: 'Materiales' },
  { value: 'Equipos', label: 'Equipos' },
  { value: 'Herramientas', label: 'Herramientas' },
  { value: 'Repuestos', label: 'Repuestos' },
  { value: 'Servicios', label: 'Servicios' },
]

export function ProductDrawer({
  isOpen,
  onClose,
  onCreated,
  repository,
}: ProductDrawerProps) {
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [category, setCategory] = useState<ProductCategory>('Materiales')
  const [description, setDescription] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('0.00')
  const [sellingPrice, setSellingPrice] = useState('0.00')
  const [stock, setStock] = useState('0')
  const [minStock, setMinStock] = useState('10')

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFieldErrors({})
    setGeneralError(null)

    const errors: Record<string, string> = {}
    if (!name.trim()) errors.name = 'El nombre del producto es obligatorio.'
    if (!sku.trim()) errors.sku = 'El código / SKU es obligatorio.'

    const parsedSelling = parseFloat(sellingPrice)
    if (isNaN(parsedSelling) || parsedSelling < 0) {
      errors.sellingPrice = 'Ingresa un precio de venta válido mayor o igual a 0.'
    }

    const parsedPurchase = parseFloat(purchasePrice)
    if (isNaN(parsedPurchase) || parsedPurchase < 0) {
      errors.purchasePrice = 'Ingresa un precio de compra válido mayor o igual a 0.'
    }

    const parsedStock = parseInt(stock, 10)
    if (isNaN(parsedStock) || parsedStock < 0) {
      errors.stock = 'El stock inicial debe ser mayor o igual a 0.'
    }

    const parsedMinStock = parseInt(minStock, 10)
    if (isNaN(parsedMinStock) || parsedMinStock < 0) {
      errors.minStock = 'El stock mínimo debe ser mayor o igual a 0.'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setIsSubmitting(true)
    try {
      const input: ProductInput = {
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        category,
        description: description.trim() || undefined,
        purchasePriceCents: Math.round(parsedPurchase * 100),
        sellingPriceCents: Math.round(parsedSelling * 100),
        stock: parsedStock,
        minStock: parsedMinStock,
      }

      const created = await repository.create(input)
      onCreated(created)
      onClose()
    } catch (err) {
      if (err instanceof InventoryApiError) {
        if (err.kind === 'validation') {
          setFieldErrors(err.details ?? { general: err.message })
        } else {
          setGeneralError(err.message)
        }
      } else {
        setGeneralError('No se pudo registrar el producto. Inténtalo de nuevo.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const drawerFooter = (
    <div className="product-drawer-footer">
      <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
        Cancelar
      </Button>
      <Button
        variant="primary"
        type="submit"
        form="product-drawer-form"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Guardando...' : 'Guardar producto'}
      </Button>
    </div>
  )

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo producto"
      footer={drawerFooter}
    >
      <p className="product-drawer-subtitle">
        Ingresa los datos para registrar un nuevo artículo en bodega.
      </p>
      <form
        id="product-drawer-form"
        className="product-drawer-form"
        onSubmit={handleSubmit}
        noValidate
      >
        {generalError && (
          <Alert variant="error" title="Error al guardar">
            {generalError}
          </Alert>
        )}

        {/* Zona decorativa de fotografía Stitch */}
        <div className="product-drawer-photo-zone">
          <label className="product-drawer-label">Fotografía del producto (Opcional)</label>
          <div className="product-drawer-photo-box" aria-disabled="true">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="product-drawer-photo-title">Carga de imagen no disponible en este modo</p>
            <p className="product-drawer-photo-subtitle">PNG o JPG hasta 5MB</p>
          </div>
        </div>

        <Input
          id="product-name"
          label="Nombre del producto"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Cemento Portland Tipo I (50kg)"
          required
          error={fieldErrors.name}
        />

        <div className="product-drawer-row">
          <Input
            id="product-sku"
            label="Código / SKU"
            value={sku}
            onChange={(e) => setSku(e.target.value.toUpperCase())}
            placeholder="Ej. MAT-2026-085"
            required
            error={fieldErrors.sku}
          />

          <Select
            id="product-category"
            label="Categoría"
            value={category}
            onChange={(e) => setCategory(e.target.value as ProductCategory)}
            options={CATEGORY_OPTIONS}
            required
            error={fieldErrors.category}
          />
        </div>

        <div className="product-drawer-field">
          <label htmlFor="product-description" className="product-drawer-label">
            Descripción técnica
          </label>
          <textarea
            id="product-description"
            className="product-drawer-textarea"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción técnica o especificaciones del producto..."
          />
        </div>

        <p className="product-drawer-section-title">Estructura de Precios (USD)</p>
        <div className="product-drawer-row">
          <Input
            id="product-purchase-price"
            label="Precio de compra ($)"
            type="number"
            step="0.01"
            min="0"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            error={fieldErrors.purchasePrice}
          />

          <Input
            id="product-selling-price"
            label="Precio de venta ($)"
            type="number"
            step="0.01"
            min="0"
            value={sellingPrice}
            onChange={(e) => setSellingPrice(e.target.value)}
            required
            error={fieldErrors.sellingPrice}
          />
        </div>

        <p className="product-drawer-section-title">Parámetros de Stock y Bodega</p>
        <div className="product-drawer-row">
          <Input
            id="product-initial-stock"
            label="Stock inicial"
            type="number"
            min="0"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            error={fieldErrors.stock}
          />

          <Input
            id="product-min-stock"
            label="Stock mínimo (Alerta)"
            type="number"
            min="0"
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
            error={fieldErrors.minStock}
          />
        </div>
      </form>
    </Drawer>
  )
}
