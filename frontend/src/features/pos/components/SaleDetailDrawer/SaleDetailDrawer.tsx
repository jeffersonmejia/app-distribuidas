// SOLID: SRP — ESTE COMPONENTE GESTIONA EXCLUSIVAMENTE LA VISUALIZACIÓN DEL DETALLE DE UN COMPROBANTE DE VENTA.

import { useState, useEffect } from 'react'
import { Drawer } from '../../../../components/ui/Drawer'
import { Button, Badge, type BadgeVariant } from '../../../../components/ui'
import { Spinner, Alert } from '../../../../components/feedback'
import { getPosRepository, type PosRepository } from '../../services'
import type { Sale, SaleStatus } from '../../types/sale'
import { formatMoney } from '../../../../utils/formatMoney'
import './SaleDetailDrawer.css'

export interface SaleDetailDrawerProps {
  isOpen: boolean
  onClose: () => void
  saleId: string | null
  repository?: PosRepository
}

function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate)
    return isNaN(d.getTime())
      ? isoDate
      : d.toLocaleDateString('es-EC', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
  } catch {
    return isoDate
  }
}

function getStatusBadgeConfig(status: SaleStatus): { label: string; variant: BadgeVariant } {
  switch (status) {
    case 'paid':
      return { label: 'Pagada', variant: 'success' }
    case 'pending':
      return { label: 'Pendiente', variant: 'warning' }
    case 'overdue':
      return { label: 'Vencida', variant: 'error' }
  }
}

export function SaleDetailDrawer({
  isOpen,
  onClose,
  saleId,
  repository,
}: SaleDetailDrawerProps) {
  const repo = repository ?? getPosRepository()
  const [sale, setSale] = useState<Sale | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isLoading = Boolean(isOpen && saleId && (!sale || sale.id !== saleId) && !errorMessage)

  useEffect(() => {
    if (!isOpen || !saleId) return

    let ignore = false

    repo
      .getById(saleId)
      .then((data) => {
        if (!ignore) {
          setSale(data)
        }
      })
      .catch((err) => {
        if (!ignore) {
          setErrorMessage(err instanceof Error ? err.message : 'No se pudo cargar el comprobante.')
        }
      })

    return () => {
      ignore = true
    }
  }, [isOpen, saleId, repo])

  const footer = (
    <div className="sale-detail-drawer__footer">
      <Button type="button" variant="secondary" onClick={onClose}>
        Cerrar
      </Button>
      <Button
        type="button"
        variant="primary"
        disabled
        title="Descarga de PDF disponible en la siguiente fase de backend"
      >
        Descargar PDF
      </Button>
    </div>
  )

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Detalle de comprobante"
      footer={footer}
    >
      {isLoading && (
        <div className="sale-detail-drawer__loading" role="status">
          <Spinner size="lg" label="Cargando información del comprobante..." />
        </div>
      )}

      {errorMessage && !isLoading && (
        <Alert variant="error" title="Error al consultar venta">
          {errorMessage}
        </Alert>
      )}

      {!isLoading && !errorMessage && sale && (
        <div className="sale-detail-drawer__content">
          {/* Encabezado del comprobante */}
          <div className="sale-detail-drawer__receipt-header">
            <div className="sale-detail-drawer__receipt-id">
              <span className="sale-detail-drawer__receipt-type">{sale.type}</span>
              <h3 className="sale-detail-drawer__receipt-number">{sale.receiptNumber}</h3>
            </div>
            <div className="sale-detail-drawer__receipt-status">
              <Badge variant={getStatusBadgeConfig(sale.status).variant}>
                {getStatusBadgeConfig(sale.status).label}
              </Badge>
            </div>
          </div>

          {/* Información del cliente y emisión */}
          <div className="sale-detail-drawer__section">
            <h4 className="sale-detail-drawer__section-title">Datos del cliente</h4>
            <dl className="sale-detail-drawer__grid">
              <div className="sale-detail-drawer__field">
                <dt className="sale-detail-drawer__label">Razón Social / Nombre:</dt>
                <dd className="sale-detail-drawer__value">{sale.customerName}</dd>
              </div>
              <div className="sale-detail-drawer__field">
                <dt className="sale-detail-drawer__label">Identificación (RUC/CI):</dt>
                <dd className="sale-detail-drawer__value sale-detail-drawer__value--mono">
                  {sale.customerIdentification}
                </dd>
              </div>
              <div className="sale-detail-drawer__field">
                <dt className="sale-detail-drawer__label">Fecha de emisión:</dt>
                <dd className="sale-detail-drawer__value">{formatDate(sale.issuedAt)}</dd>
              </div>
              <div className="sale-detail-drawer__field">
                <dt className="sale-detail-drawer__label">Forma de pago:</dt>
                <dd className="sale-detail-drawer__value">{sale.paymentMethod}</dd>
              </div>
            </dl>
          </div>

          {/* Tabla de ítems y líneas de producto */}
          <div className="sale-detail-drawer__section">
            <div className="sale-detail-drawer__items-header">
              <h4 className="sale-detail-drawer__section-title">Ítems facturados</h4>
              <span className="sale-detail-drawer__items-count">
                {sale.lines.length} {sale.lines.length === 1 ? 'ítem' : 'ítems'}
              </span>
            </div>

            <div className="sale-detail-drawer__table-wrapper">
              <table className="sale-detail-drawer__table" aria-label="Líneas de la venta">
                <thead>
                  <tr>
                    <th scope="col">Descripción / SKU</th>
                    <th scope="col" className="sale-detail-drawer__cell--right">Cant.</th>
                    <th scope="col" className="sale-detail-drawer__cell--right">Precio Unit.</th>
                    <th scope="col" className="sale-detail-drawer__cell--right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.lines.map((line, idx) => (
                    <tr key={`${line.productId}-${idx}`}>
                      <td>
                        <div className="sale-detail-drawer__line-desc">
                          <span className="sale-detail-drawer__line-name">{line.name}</span>
                          <span className="sale-detail-drawer__line-sku">SKU: {line.sku}</span>
                        </div>
                      </td>
                      <td className="sale-detail-drawer__cell--right sale-detail-drawer__cell--mono">
                        {line.quantity}
                      </td>
                      <td className="sale-detail-drawer__cell--right sale-detail-drawer__cell--mono">
                        {formatMoney(line.unitPriceCents)}
                      </td>
                      <td className="sale-detail-drawer__cell--right sale-detail-drawer__cell--mono sale-detail-drawer__cell--bold">
                        {formatMoney(line.subtotalCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Liquidación económica y totales */}
          <div className="sale-detail-drawer__totals-box">
            <h4 className="sale-detail-drawer__totals-title">Liquidación económica</h4>
            <div className="sale-detail-drawer__totals-rows">
              <div className="sale-detail-drawer__totals-row">
                <span>Subtotal 0% (exento)</span>
                <span className="sale-detail-drawer__cell--mono">{formatMoney(sale.subtotal0Cents)}</span>
              </div>
              <div className="sale-detail-drawer__totals-row">
                <span>Subtotal gravado (15%)</span>
                <span className="sale-detail-drawer__cell--mono">{formatMoney(sale.subtotalGravadoCents)}</span>
              </div>
              {sale.discountCents > 0 && (
                <div className="sale-detail-drawer__totals-row sale-detail-drawer__totals-row--discount">
                  <span>Descuento comercial</span>
                  <span className="sale-detail-drawer__cell--mono">-{formatMoney(sale.discountCents)}</span>
                </div>
              )}
              <div className="sale-detail-drawer__totals-row">
                <span>IVA vigente (15%)</span>
                <span className="sale-detail-drawer__cell--mono">{formatMoney(sale.ivaCents)}</span>
              </div>
              <div className="sale-detail-drawer__totals-row sale-detail-drawer__totals-row--total">
                <span className="sale-detail-drawer__total-label">Total a liquidar</span>
                <span className="sale-detail-drawer__total-value">{formatMoney(sale.totalCents)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  )
}
