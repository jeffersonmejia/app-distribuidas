// SOLID: SRP — PANTALLA PARA LA CREACIÓN Y EMISIÓN DE NUEVAS VENTAS CON ORQUESTACIÓN DE INVENTARIO Y CLIENTES.

import { useState, useEffect, useRef } from 'react'
import { useRouter } from '../../../../app/router'
import type { PosRepository } from '../../services/posRepository'
import { getPosRepository } from '../../services'
import type { InventoryRepository } from '../../../inventory/services/inventoryRepository'
import { getInventoryRepository } from '../../../inventory/services'
import type { CustomerRepository } from '../../../crm/services/customerRepository'
import { getCustomerRepository } from '../../../crm/services'
import type { CustomerView } from '../../../crm/types/customer'
import type { PaymentMethod, Sale, SaleLine } from '../../types/sale'
import { calcLineSubtotal, calcSaleTotals } from '../../utils/calculations'
import { formatMoney } from '../../../../utils/formatMoney'
import { ProductSelectModal } from '../../components/ProductSelectModal'
import { ConfirmDialog } from '../../../../components/feedback/ConfirmDialog'
import { Spinner } from '../../../../components/feedback/Spinner'
import { Alert } from '../../../../components/feedback/Alert'
import { Input, Select } from '../../../../components/forms'
import './NewSalePage.css'
import { ContractSaleForm } from './ContractSaleForm'

export interface NewSalePageProps {
  posRepository?: PosRepository
  inventoryRepository?: InventoryRepository
  customerRepository?: CustomerRepository
}

interface NewSaleLineItem extends SaleLine {
  availableStock: number
}

function getTodayIsoDate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// SOLID: OCP — LA PANTALLA CONSUME REPOSITORIOS INYECTABLES PERMITIENDO VARIAR SU COMPORTAMIENTO SIN MODIFICAR EL FLUJO.
function LegacyNewSalePage({
  posRepository,
  inventoryRepository,
  customerRepository,
}: NewSalePageProps) {
  const { navigate } = useRouter()

  const posRepo = posRepository ?? getPosRepository()
  const invRepo = inventoryRepository ?? getInventoryRepository()
  const custRepo = customerRepository ?? getCustomerRepository()

  // Datos del cliente
  const [customers, setCustomers] = useState<CustomerView[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerIdentification, setCustomerIdentification] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false)

  // Datos generales de la transacción
  const [issuedAt, setIssuedAt] = useState(getTodayIsoDate())
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Transferencia bancaria')

  // Líneas de producto
  const [lines, setLines] = useState<NewSaleLineItem[]>([])

  // Descuento y notas
  const [discountCentsInput, setDiscountCentsInput] = useState<number>(0)
  const [notes, setNotes] = useState('')

  // Estados de control y modales
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isConfirmCancelOpen, setIsConfirmCancelOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [createdSale, setCreatedSale] = useState<Sale | null>(null)

  const customerDropdownRef = useRef<HTMLDivElement>(null)

  // Carga de clientes
  useEffect(() => {
    let isMounted = true
    custRepo
      .list({}, 0)
      .then((res) => {
        if (isMounted) {
          setCustomers(res.items)
        }
      })
      .catch(() => {
        // Fallback silencioso; se puede ingresar datos manualmente o reintentar
      })
    return () => {
      isMounted = false
    }
  }, [custRepo])

  // Cierre de dropdown de clientes al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCustomerDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Selección de cliente
  function handleSelectCustomer(c: CustomerView) {
    setSelectedCustomerId(c.id)
    setCustomerName(c.fullName)
    setCustomerIdentification(c.cedula || '')
    setCustomerSearch(`${c.fullName} - ${c.cedula || ''}`)
    setIsCustomerDropdownOpen(false)
    setErrorMessage(null)
  }

  // Agregar producto desde el modal
  function handleAddProduct(product: {
    id: string
    name: string
    sku: string
    stock: number
    sellingPriceCents: number
  }) {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id)
      if (existing) {
        const nextQty = existing.quantity + 1
        return prev.map((l) =>
          l.productId === product.id
            ? {
                ...l,
                quantity: nextQty,
                subtotalCents: calcLineSubtotal(nextQty, l.unitPriceCents),
                availableStock: product.stock,
              }
            : l
        )
      }

      const newLine: NewSaleLineItem = {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity: 1,
        unitPriceCents: product.sellingPriceCents,
        subtotalCents: calcLineSubtotal(1, product.sellingPriceCents),
        availableStock: product.stock,
      }
      return [...prev, newLine]
    })
    setErrorMessage(null)
  }

  // Modificar cantidad en línea
  function handleQuantityChange(productId: string, rawVal: string) {
    const qty = rawVal === '' ? 0 : Math.max(0, parseInt(rawVal, 10) || 0)

    setLines((prev) =>
      prev.map((l) =>
        l.productId === productId
          ? {
              ...l,
              quantity: qty,
              subtotalCents: calcLineSubtotal(qty, l.unitPriceCents),
            }
          : l
      )
    )
  }

  // Eliminar línea
  function handleRemoveLine(productId: string) {
    setLines((prev) => prev.filter((l) => l.productId !== productId))
  }

  // Cálculos automáticos de totales
  const totals = calcSaleTotals(lines, discountCentsInput)

  // Envío del formulario de venta
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    if (!customerName.trim() || !customerIdentification.trim()) {
      setErrorMessage('Debes seleccionar o especificar un cliente y su identificación (RUC o cédula).')
      return
    }

    if (lines.length === 0) {
      setErrorMessage('Debes agregar al menos un producto a la venta.')
      return
    }

    // Validación preventiva en cliente del stock
    const outOfStockLine = lines.find((l) => l.quantity > l.availableStock)
    if (outOfStockLine) {
      setErrorMessage(
        `Stock insuficiente para "${outOfStockLine.name}". Disponible: ${outOfStockLine.availableStock}, solicitado: ${outOfStockLine.quantity}.`
      )
      return
    }

    setIsSubmitting(true)
    try {
      const sale = await posRepo.createSale({
        customerId: selectedCustomerId || undefined,
        customerName: customerName.trim(),
        customerIdentification: customerIdentification.trim(),
        issuedAt,
        paymentMethod,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
        })),
        discountCents: discountCentsInput,
        notes: notes.trim() || undefined,
      })

      setCreatedSale(sale)
    } catch (err: unknown) {
      const errorObj = err as Error
      setErrorMessage(errorObj.message || 'Error al emitir la venta en el repositorio.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Comprobar si el formulario tiene cambios antes de salir
  const isDirty = Boolean(
    selectedCustomerId ||
      customerName ||
      lines.length > 0 ||
      notes ||
      discountCentsInput > 0
  )

  function handleCancelClick() {
    if (isDirty) {
      setIsConfirmCancelOpen(true)
    } else {
      navigate('/pos')
    }
  }

  function handleResetForm() {
    setSelectedCustomerId('')
    setCustomerName('')
    setCustomerIdentification('')
    setCustomerSearch('')
    setLines([])
    setDiscountCentsInput(0)
    setNotes('')
    setErrorMessage(null)
    setCreatedSale(null)
  }

  // Filtro de clientes en el combobox
  const filteredCustomers = customers.filter((c) => {
    if (!customerSearch.trim()) return true
    const q = customerSearch.toLowerCase()
    return (
      c.fullName.toLowerCase().includes(q) ||
      (c.cedula && c.cedula.toLowerCase().includes(q))
    )
  })

  // Vista de éxito
  if (createdSale) {
    return (
      <div className="new-sale-page new-sale-page--success">
        <div className="new-sale-success-card" role="status" aria-live="polite">
          <div className="new-sale-success-card__icon" aria-hidden="true">
            <svg fill="currentColor" viewBox="0 0 24 24" width="48" height="48">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          </div>
          <h1 className="new-sale-success-card__title">¡Venta emitida con éxito!</h1>
          <p className="new-sale-success-card__description">
            El comprobante{' '}
            <strong className="new-sale-success-card__highlight">
              {createdSale.receiptNumber}
            </strong>{' '}
            ha sido generado correctamente. Las existencias en inventario fueron actualizadas de
            forma atómica.
          </p>

          <div className="new-sale-success-card__details">
            <div className="new-sale-success-card__detail-row">
              <span className="new-sale-success-card__detail-label">Cliente:</span>
              <span className="new-sale-success-card__detail-val">
                {createdSale.customerName} ({createdSale.customerIdentification})
              </span>
            </div>
            <div className="new-sale-success-card__detail-row">
              <span className="new-sale-success-card__detail-label">Total pagado:</span>
              <span className="new-sale-success-card__detail-val new-sale-success-card__detail-val--bold">
                {formatMoney(createdSale.totalCents)} USD
              </span>
            </div>
            <div className="new-sale-success-card__detail-row">
              <span className="new-sale-success-card__detail-label">Forma de pago:</span>
              <span className="new-sale-success-card__detail-val">
                {createdSale.paymentMethod}
              </span>
            </div>
            <div className="new-sale-success-card__detail-row">
              <span className="new-sale-success-card__detail-label">Estado:</span>
              <span className="new-sale-success-card__detail-val">
                {createdSale.status === 'paid' ? 'Pagada' : 'Pendiente'}
              </span>
            </div>
          </div>

          <div className="new-sale-success-card__actions">
            <button
              type="button"
              className="btn btn--primary btn--md"
              onClick={() => navigate('/pos')}
            >
              Ver listado de ventas
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--md"
              onClick={handleResetForm}
            >
              + Emitir otra venta
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="new-sale-page">
      {/* Cabecera institucional con gradiente Stitch */}
      <section className="new-sale-page__hero" aria-label="Encabezado de nueva venta">
        <div className="new-sale-page__hero-content">
          <button
            type="button"
            className="new-sale-page__back-link"
            onClick={handleCancelClick}
            aria-label="Volver a Ventas"
          >
            ← Volver a Ventas
          </button>
          <div className="new-sale-page__hero-title-row">
            <h1 className="new-sale-page__hero-title">Nueva venta</h1>
            <span className="new-sale-page__badge">
              <span className="new-sale-page__badge-dot" />
              Borrador en edición
            </span>
          </div>
          <p className="new-sale-page__hero-subtitle">
            Emisión de comprobante comercial y registro contable en tiempo real.
          </p>
        </div>
      </section>

      {/* Alerta de error global */}
      {errorMessage && (
        <div className="new-sale-page__alert-wrapper">
          <Alert variant="error" title="Atención al emitir la venta">
            {errorMessage}
          </Alert>
        </div>
      )}

      {/* Formulario Principal en Bento Grid */}
      <form onSubmit={handleSubmit} className="new-sale-page__form">
        <div className="new-sale-page__grid">
          {/* Columna Izquierda: Datos de la transacción y Productos */}
          <div className="new-sale-page__main-col">
            {/* Tarjeta 1: Datos de la transacción */}
            <div className="new-sale-card">
              <div className="new-sale-card__header">
                <div className="new-sale-card__header-text">
                  <h2 className="new-sale-card__title">Datos de la transacción</h2>
                  <p className="new-sale-card__subtitle">
                    Identificación fiscal y términos del comprobante
                  </p>
                </div>
              </div>

              <div className="new-sale-card__body">
                {/* Cliente / Razón Social Combobox */}
                <div className="new-sale-card__col new-sale-card__col--full" ref={customerDropdownRef}>
                  <div className="new-sale-card__combobox-wrapper">
                    <Input
                      id="customer-input"
                      label="Cliente / Razón Social *"
                      placeholder="Buscar cliente por nombre o RUC..."
                      value={customerSearch}
                      onChange={(e) => {
                        const val = e.target.value
                        setCustomerSearch(val)
                        setCustomerName(val)
                        if (selectedCustomerId) {
                          setSelectedCustomerId('')
                        }
                        setIsCustomerDropdownOpen(true)
                      }}
                      onFocus={() => setIsCustomerDropdownOpen(true)}
                      autoComplete="off"
                      aria-label="Buscar o ingresar cliente"
                      endAdornment={
                        <button
                          type="button"
                          className="new-sale-card__dropdown-toggle"
                          onClick={() => setIsCustomerDropdownOpen((prev) => !prev)}
                          aria-label="Mostrar lista de clientes"
                          aria-expanded={isCustomerDropdownOpen}
                        >
                          ▾
                        </button>
                      }
                    />

                    {isCustomerDropdownOpen && (
                      <div className="new-sale-card__customer-dropdown" role="listbox">
                        {filteredCustomers.length === 0 ? (
                          <div className="new-sale-card__customer-option new-sale-card__customer-option--empty">
                            No se encontraron clientes. Puedes escribir el nombre e identificación
                            directamente.
                          </div>
                        ) : (
                          filteredCustomers.map((c) => (
                            <div
                              key={c.id}
                              role="option"
                              aria-selected={selectedCustomerId === c.id}
                              className={`new-sale-card__customer-option ${
                                selectedCustomerId === c.id
                                  ? 'new-sale-card__customer-option--active'
                                  : ''
                              }`}
                              onClick={() => handleSelectCustomer(c)}
                            >
                              <span className="new-sale-card__customer-option-name">{c.fullName}</span>
                              <span className="new-sale-card__customer-option-meta">
                                RUC/CI: {c.cedula || 'S/N'}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Cédula o RUC (autocompletado de solo lectura al elegir cliente, o manual alineado al ancho) */}
                <div className="new-sale-card__col new-sale-card__col--full">
                  <Input
                    id="customer-identification"
                    label="Cédula o RUC *"
                    placeholder="Cédula o RUC del cliente *"
                    value={customerIdentification}
                    onChange={(e) => setCustomerIdentification(e.target.value)}
                    readOnly={Boolean(selectedCustomerId)}
                    aria-label="Cédula o RUC del cliente"
                    hint={selectedCustomerId ? '✓ Cliente seleccionado' : undefined}
                    className={selectedCustomerId ? 'new-sale-card__readonly-field' : ''}
                  />
                </div>

                <div className="new-sale-card__row">
                  {/* Fecha de emisión */}
                  <div className="new-sale-card__col">
                    <Input
                      id="issue-date"
                      type="date"
                      label="Fecha de emisión *"
                      value={issuedAt}
                      onChange={(e) => setIssuedAt(e.target.value)}
                      required
                    />
                  </div>

                  {/* Forma de pago */}
                  <div className="new-sale-card__col">
                    <Select
                      id="payment-method"
                      label="Forma de pago *"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      options={[
                        { value: 'Transferencia bancaria', label: 'Transferencia bancaria' },
                        { value: 'Efectivo', label: 'Efectivo contra entrega' },
                        { value: 'Crédito 30 días', label: 'Crédito 30 días' },
                      ]}
                    />
                  </div>
                </div>

                {/* Punto de emisión / Serie */}
                <div className="new-sale-card__col new-sale-card__col--full">
                  <Input
                    id="establishment-point"
                    label="Punto de emisión / Establecimiento"
                    value="001-001 Matriz"
                    readOnly
                    className="new-sale-card__readonly-field"
                  />
                </div>
              </div>
            </div>

            {/* Tarjeta 2: Ítems y productos */}
            <div className="new-sale-card">
              <div className="new-sale-card__header">
                <div className="new-sale-card__header-text">
                  <h2 className="new-sale-card__title">Ítems y productos</h2>
                  <p className="new-sale-card__subtitle">
                    {lines.length}{' '}
                    {lines.length === 1 ? 'referencia añadida' : 'referencias añadidas'} desde
                    inventario
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm new-sale-card__add-btn"
                  onClick={() => setIsProductModalOpen(true)}
                >
                  + Agregar producto
                </button>
              </div>

              <div className="new-sale-card__body">
                {lines.length === 0 ? (
                  <div className="new-sale-card__empty-lines">
                    <p className="new-sale-card__empty-title">No hay productos en esta venta</p>
                    <p className="new-sale-card__empty-desc">
                      Haz clic en "+ Agregar producto" para seleccionar ítems del catálogo de
                      inventario.
                    </p>
                    <button
                      type="button"
                      className="btn btn--primary btn--md"
                      onClick={() => setIsProductModalOpen(true)}
                    >
                      + Seleccionar del inventario
                    </button>
                  </div>
                ) : (
                  <div className="new-sale-table-wrapper">
                    <table className="new-sale-table" aria-label="Líneas de productos en la venta">
                      <thead>
                        <tr>
                          <th className="new-sale-table__th">Producto / Descripción</th>
                          <th className="new-sale-table__th new-sale-table__th--center">Cantidad</th>
                          <th className="new-sale-table__th new-sale-table__th--right">Precio Unitario</th>
                          <th className="new-sale-table__th new-sale-table__th--right">Subtotal</th>
                          <th className="new-sale-table__th new-sale-table__th--center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line) => {
                          const isOverStock = line.quantity > line.availableStock
                          return (
                            <tr key={line.productId} className="new-sale-table__tr">
                              <td className="new-sale-table__td">
                                <div className="new-sale-table__product-cell">
                                  <span className="new-sale-table__product-name">{line.name}</span>
                                  <div className="new-sale-table__product-meta">
                                    <span className="new-sale-table__product-sku">{line.sku}</span>
                                    <span>•</span>
                                    <span
                                      className={`new-sale-table__product-stock ${
                                        isOverStock ? 'new-sale-table__product-stock--alert' : ''
                                      }`}
                                    >
                                      Disponible: {line.availableStock}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="new-sale-table__td new-sale-table__td--center">
                                <input
                                  type="number"
                                  min={1}
                                  className={`new-sale-table__qty-input ${
                                    isOverStock ? 'new-sale-table__qty-input--alert' : ''
                                  }`}
                                  value={line.quantity === 0 ? '' : line.quantity}
                                  onChange={(e) =>
                                    handleQuantityChange(line.productId, e.target.value)
                                  }
                                  aria-label={`Cantidad para ${line.name}`}
                                />
                              </td>
                              <td className="new-sale-table__td new-sale-table__td--right new-sale-table__td--mono">
                                {formatMoney(line.unitPriceCents)} USD
                              </td>
                              <td className="new-sale-table__td new-sale-table__td--right new-sale-table__td--mono new-sale-table__td--bold">
                                {formatMoney(line.subtotalCents)} USD
                              </td>
                              <td className="new-sale-table__td new-sale-table__td--center">
                                <button
                                  type="button"
                                  className="new-sale-table__remove-btn"
                                  onClick={() => handleRemoveLine(line.productId)}
                                  aria-label={`Eliminar producto ${line.name}`}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    <button
                      type="button"
                      className="new-sale-card__add-more-btn"
                      onClick={() => setIsProductModalOpen(true)}
                    >
                      + Añadir otra línea de producto
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Columna Derecha: Resumen de venta y Acciones */}
          <div className="new-sale-page__side-col">
            <div className="new-sale-card new-sale-card--summary">
              <div className="new-sale-card__header">
                <h2 className="new-sale-card__title">Resumen de venta</h2>
                <span className="new-sale-card__badge-calc">Cálculo exacto</span>
              </div>

              <div className="new-sale-summary-breakdown">
                <div className="new-sale-summary-row">
                  <span>Subtotal 0% (exento):</span>
                  <span className="new-sale-summary-val">{formatMoney(totals.subtotal0Cents)} USD</span>
                </div>
                <div className="new-sale-summary-row">
                  <span>Subtotal gravado (15%):</span>
                  <span className="new-sale-summary-val">
                    {formatMoney(totals.subtotalGravadoCents)} USD
                  </span>
                </div>

                <div className="new-sale-summary-discount-wrapper">
                  <Input
                    id="discount-input"
                    type="number"
                    min="0"
                    step="0.01"
                    label="Descuento comercial (USD)"
                    value={discountCentsInput ? (discountCentsInput / 100).toFixed(2) : '0.00'}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0
                      setDiscountCentsInput(Math.max(0, Math.round(val * 100)))
                    }}
                    aria-label="Descuento comercial en dólares"
                  />
                </div>

                <div className="new-sale-summary-row">
                  <span>IVA vigente (15%):</span>
                  <span className="new-sale-summary-val">{formatMoney(totals.ivaCents)} USD</span>
                </div>

                <div className="new-sale-summary-divider" />

                <div className="new-sale-summary-total">
                  <span className="new-sale-summary-total-label">Total a pagar:</span>
                  <span className="new-sale-summary-total-amount">
                    {formatMoney(totals.totalCents)}{' '}
                    <span className="new-sale-summary-currency">USD</span>
                  </span>
                </div>
              </div>

              {/* Condiciones y notas */}
              <div className="input-field new-sale-card__notes-field">
                <label className="input-field__label" htmlFor="notes-input">
                  <span>Condiciones y notas</span>
                  <span className="new-sale-card__optional"> (Opcional)</span>
                </label>
                <div className="input-field__wrapper">
                  <textarea
                    id="notes-input"
                    className="input-field__control new-sale-card__notes-textarea"
                    rows={2}
                    placeholder="Ej: Condiciones de entrega en obra, descarga programada..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Botones de acción */}
              <div className="new-sale-card__actions">
                <button
                  type="submit"
                  className="btn btn--primary btn--lg new-sale-card__submit-btn"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Spinner />
                      <span>Emitiendo comprobante...</span>
                    </>
                  ) : (
                    'Emitir venta'
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn--ghost btn--md"
                  disabled
                  title="Guardado de borrador disponible en la siguiente fase de arquitectura"
                >
                  Guardar borrador
                </button>

                <button
                  type="button"
                  className="new-sale-card__cancel-btn"
                  onClick={handleCancelClick}
                >
                  Cancelar transacción
                </button>
              </div>
            </div>

            {/* Tarjeta de verificación de stock */}
            <div className="new-sale-stock-badge">
              <div className="new-sale-stock-badge__icon" aria-hidden="true">
                ✓
              </div>
              <div className="new-sale-stock-badge__text">
                <span className="new-sale-stock-badge__title">Control de existencias</span>
                <span className="new-sale-stock-badge__subtitle">
                  El stock se descuenta en inventario al confirmar la emisión.
                </span>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Modal de selección de productos */}
      <ProductSelectModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSelectProduct={handleAddProduct}
        selectedProductIds={lines.map((l) => l.productId)}
        inventoryRepository={invRepo}
      />

      {/* Diálogo de confirmación para cancelar transacción */}
      <ConfirmDialog
        isOpen={isConfirmCancelOpen}
        title="¿Descartar transacción?"
        description="Hay datos ingresados en esta venta que se perderán al salir. ¿Deseas volver al listado de ventas?"
        confirmLabel="Sí, descartar"
        cancelLabel="Continuar editando"
        onConfirm={() => navigate('/pos')}
        onCancel={() => setIsConfirmCancelOpen(false)}
      />
    </div>
  )
}

//SOLID: OCP — SELECCIONA EL FORMULARIO QUE CORRESPONDE AL CONTRATO DEL REPOSITORIO.
export function NewSalePage(props: NewSalePageProps) {
  const posRepo = props.posRepository ?? getPosRepository()
  if (posRepo.createFromContract) {
    return <ContractSaleForm
      posRepository={posRepo}
      inventoryRepository={props.inventoryRepository ?? getInventoryRepository()}
    />
  }
  return <LegacyNewSalePage {...props} posRepository={posRepo} />
}
