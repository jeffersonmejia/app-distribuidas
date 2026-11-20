// SOLID: SRP — ESTE COMPONENTE MUESTRA EXCLUSIVAMENTE LA INFORMACIÓN EN DETALLE DE UN CLIENTE.

import { Drawer } from '../../../components/ui/Drawer'
import { Button, Badge } from '../../../components/ui'
import type { CustomerView } from '../types/customer'
import './CustomerDetailDrawer.css'

export interface CustomerDetailDrawerProps {
  isOpen: boolean
  onClose: () => void
  customer: CustomerView | null
  onEdit?: (customer: CustomerView) => void
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'CL'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
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
        })
  } catch {
    return isoDate
  }
}

export function CustomerDetailDrawer({
  isOpen,
  onClose,
  customer,
  onEdit,
}: CustomerDetailDrawerProps) {
  if (!customer) {
    return (
      <Drawer isOpen={isOpen} onClose={onClose} title="Detalle de cliente">
        <p className="customer-detail__empty">No se seleccionó ningún cliente.</p>
      </Drawer>
    )
  }

  const footer = (
    <div className="customer-detail-footer">
      <Button type="button" variant="secondary" onClick={onClose}>
        Cerrar
      </Button>
      {onEdit && (
        <Button
          type="button"
          variant="primary"
          onClick={() => {
            onEdit(customer)
            onClose()
          }}
        >
          Editar cliente
        </Button>
      )}
    </div>
  )

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Detalle de cliente" footer={footer}>
      <div className="customer-detail">
        {/* Cabecera del detalle */}
        <div className="customer-detail__header">
          <div className="customer-detail__avatar" aria-hidden="true">
            {getInitials(customer.fullName)}
          </div>
          <div className="customer-detail__header-info">
            <h3 className="customer-detail__name">{customer.fullName}</h3>
            <Badge variant={customer.status === 'ACTIVE' ? 'success' : 'neutral'}>
              {customer.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
        </div>

        <div className="customer-detail__divider" />

        {/* Sección de datos de contacto e identificación */}
        <div className="customer-detail__section">
          <h4 className="customer-detail__section-title">Información de contacto</h4>
          <dl className="customer-detail__list">
            <div className="customer-detail__item">
              <dt className="customer-detail__term">Identificación (Cédula)</dt>
              <dd className="customer-detail__desc">{customer.cedula ?? 'No registrada'}</dd>
            </div>
            <div className="customer-detail__item">
              <dt className="customer-detail__term">Correo electrónico</dt>
              <dd className="customer-detail__desc">{customer.email ?? 'No registrado'}</dd>
            </div>
            <div className="customer-detail__item">
              <dt className="customer-detail__term">Teléfono de contacto</dt>
              <dd className="customer-detail__desc">{customer.phone ?? 'No registrado'}</dd>
            </div>
          </dl>
        </div>

        <div className="customer-detail__divider" />

        {/* Sección de metadatos de registro */}
        <div className="customer-detail__section">
          <h4 className="customer-detail__section-title">Registro en sistema</h4>
          <dl className="customer-detail__list">
            <div className="customer-detail__item">
              <dt className="customer-detail__term">Fecha de registro</dt>
              <dd className="customer-detail__desc">{formatDate(customer.createdAt)}</dd>
            </div>
            <div className="customer-detail__item">
              <dt className="customer-detail__term">Última actualización</dt>
              <dd className="customer-detail__desc">{formatDate(customer.updatedAt)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </Drawer>
  )
}
