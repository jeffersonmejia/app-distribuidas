// SOLID: SRP — PRESENTA EL FORMULARIO POS-002 CON DATOS QUE PERSISTE EL BACKEND.

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from '../../../../app/router'
import { Button } from '../../../../components/ui'
import { Input } from '../../../../components/forms'
import { Alert, Spinner } from '../../../../components/feedback'
import type { InventoryRepository } from '../../../inventory/services/inventoryRepository'
import type { Product } from '../../../inventory/types/product'
import type { PosRepository } from '../../services/posRepository'
import type { ContractSaleInput, ContractSaleView } from '../../types/sale'
import './NewSalePage.css'

interface LineDraft {
  product: Product
  quantity: string
  unitPrice: string
  taxAmount: string
}

interface ContractSaleFormProps {
  posRepository: PosRepository
  inventoryRepository: InventoryRepository
}

//SOLID: SRP — VALIDA CANTIDADES POSITIVAS Y MONTOS NO NEGATIVOS CON HASTA DOS DECIMALES.
function validDecimal(value: string, positive: boolean): boolean {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return false
  const parsed = Number(value)
  return Number.isFinite(parsed) && (positive ? parsed > 0 : parsed >= 0)
}

//SOLID: SRP — CAPTURA LOS DATOS APROBADOS Y ESPERA LA CONFIRMACIÓN TRANSACCIONAL DEL BACKEND.
export function ContractSaleForm({ posRepository, inventoryRepository }: ContractSaleFormProps) {
  const { navigate } = useRouter()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [products, setProducts] = useState<Product[]>([])
  const [hasNext, setHasNext] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ContractSaleView | null>(null)
  const [saleId, setSaleId] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    setLoadError(null)
    inventoryRepository.list({ search: search || undefined }, page)
      .then((data) => {
        if (!ignore) { setProducts(data.items); setHasNext(data.hasNext) }
      })
      .catch((failure: unknown) => {
        if (!ignore) setLoadError(failure instanceof Error ? failure.message : 'No se pudo consultar el catálogo.')
      })
    return () => { ignore = true }
  }, [inventoryRepository, search, page])

  const selected = useMemo(() => products.find((product) => product.id === selectedId), [products, selectedId])

  //SOLID: SRP — AGREGA EL PRODUCTO CON SU UNIDAD DE CATÁLOGO Y PRECIO EDITABLE.
  function addLine() {
    if (!selected || lines.some((line) => line.product.id === selected.id)) return
    setLines((current) => [...current, {
      product: selected,
      quantity: '1',
      unitPrice: (selected.sellingPriceCents / 100).toFixed(2),
      taxAmount: '',
    }])
    setSelectedId('')
    setError(null)
  }

  //SOLID: SRP — MODIFICA UN CAMPO DE UNA LÍNEA SIN CAMBIAR LAS DEMÁS.
  function updateLine(productId: string, field: 'quantity' | 'unitPrice' | 'taxAmount', value: string) {
    setLines((current) => current.map((line) => line.product.id === productId ? { ...line, [field]: value } : line))
  }

  //SOLID: SRP — ENVÍA UN UUID ESTABLE Y LOS IMPORTES DECIMALES QUE POS PERSISTE.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (lines.length === 0) { setError('Agrega al menos un producto.'); return }
    if (lines.some((line) => !validDecimal(line.quantity, true)
      || !validDecimal(line.unitPrice, false) || !validDecimal(line.taxAmount, false))) {
      setError('Ingresa cantidades positivas y precio e impuesto con máximo dos decimales por línea.')
      return
    }
    if (!posRepository.createFromContract) { setError('El repositorio actual no implementa el contrato POS-002.'); return }

    setSubmitting(true)
    const stableSaleId = saleId ?? globalThis.crypto.randomUUID()
    setSaleId(stableSaleId)
    const input: ContractSaleInput = {
      saleId: stableSaleId,
      lines: lines.map((line) => ({
        productId: line.product.id,
        unit: line.product.unit,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxAmount: line.taxAmount,
      })),
    }
    try {
      setResult(await posRepository.createFromContract(input))
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'No se pudo confirmar la venta.')
    } finally { setSubmitting(false) }
  }

  if (result) {
    return (
      <main className="new-sale-page">
        <h1>Venta confirmada</h1>
        <Alert variant="success" title="POS confirmó la venta">
          Inventario y Accounting completaron la operación asociada.
        </Alert>
        <dl>
          <dt>UUID de venta</dt><dd>{result.saleId}</dd>
          <dt>Movimiento de inventario</dt><dd>{result.movementId}</dd>
          <dt>Fecha</dt><dd>{result.createdAt}</dd>
        </dl>
        <Button variant="primary" onClick={() => navigate('/pos')}>Volver a ventas</Button>
      </main>
    )
  }

  return (
    <main className="new-sale-page">
      <h1>Nueva venta</h1>
      <p>POS registra la venta junto con el descuento de existencias y el asiento contable.</p>
      {error && <Alert variant="error" title="No se pudo registrar la venta">{error}</Alert>}
      {loadError && <Alert variant="error" title="No se pudo consultar Inventory">{loadError}</Alert>}
      <section aria-labelledby="inventory-products-heading">
        <h2 id="inventory-products-heading">Productos</h2>
        <Input id="contract-product-search" label="Buscar producto por nombre o SKU" value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(0) }} />
        {loadError ? null : products.length === 0 ? <p>No hay productos en esta página.</p> : (
          <div>
            <select aria-label="Producto de inventario" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              <option value="">Seleccionar producto</option>
              {products.map((product) => <option key={product.id} value={product.id}>
                {product.name} · {product.sku} · {product.stock} {product.unit} disponibles
              </option>)}
            </select>
            <Button type="button" variant="secondary" onClick={addLine} disabled={!selected}>Agregar producto</Button>
          </div>
        )}
        <div>
          <Button type="button" variant="secondary" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Anterior</Button>
          <Button type="button" variant="secondary" disabled={!hasNext} onClick={() => setPage((current) => current + 1)}>Siguiente</Button>
        </div>
      </section>

      <form onSubmit={submit} noValidate>
        <h2>Líneas de venta</h2>
        {lines.length === 0 ? <p>Agrega productos para continuar.</p> : lines.map((line) => (
          <fieldset key={line.product.id}>
            <legend>{line.product.name} · {line.product.unit}</legend>
            <Input id={`contract-quantity-${line.product.id}`} label="Cantidad" type="number" min="0" step="any"
              value={line.quantity} onChange={(event) => updateLine(line.product.id, 'quantity', event.target.value)} required />
            <Input id={`contract-price-${line.product.id}`} label="Precio unitario (USD)" type="number" min="0" step="0.01"
              value={line.unitPrice} onChange={(event) => updateLine(line.product.id, 'unitPrice', event.target.value)} required />
            <Input id={`contract-tax-${line.product.id}`} label="Impuesto por línea (USD)" type="number" min="0" step="0.01"
              value={line.taxAmount} onChange={(event) => updateLine(line.product.id, 'taxAmount', event.target.value)} required />
            <Button type="button" variant="secondary" onClick={() => setLines((current) => current.filter((item) => item.product.id !== line.product.id))}>Quitar</Button>
          </fieldset>
        ))}
        <Button type="button" variant="secondary" onClick={() => navigate('/pos')}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={submitting || lines.length === 0}>
          {submitting ? <Spinner size="sm" label="Registrando venta..." /> : 'Confirmar venta'}
        </Button>
      </form>
    </main>
  )
}
