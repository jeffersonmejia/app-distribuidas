// SOLID: SRP - GESTIONA CREACION, DETALLE, CONTACTOS Y ENVIO MANUAL DE CAMPANAS.

import { useEffect, useState, type FormEvent } from 'react'
import { Drawer, Button, Badge } from '../../../components/ui'
import { Input } from '../../../components/forms'
import { Alert, Spinner, EmptyState } from '../../../components/feedback'
import { MarketingApiError, type MarketingRepository } from '../services'
import type { Campaign, CampaignContact, CampaignInput, CampaignStatus } from '../types/marketing'
import './CampaignDrawer.css'

export interface CampaignDrawerProps {
  isOpen: boolean
  campaign: Campaign | null
  repository: MarketingRepository
  onClose: () => void
  onSaved: (message: string, sentTodayDelta?: number) => void
}

interface FormState { name: string; description: string; startDate: string; endDate: string }
const INITIAL: FormState = { name: '', description: '', startDate: '', endDate: '' }

function canMoveTo(current: CampaignStatus, next: CampaignStatus): boolean {
  const order: CampaignStatus[] = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'FINISHED', 'CANCELLED']
  if (current === 'FINISHED' || current === 'CANCELLED') return false
  if (next === 'CANCELLED') return true
  return order.indexOf(next) === order.indexOf(current) + 1
}

function nextStatus(current: CampaignStatus): CampaignStatus | null {
  const order: CampaignStatus[] = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'FINISHED']
  const idx = order.indexOf(current)
  if (idx < 0 || idx >= order.length - 1) return null
  return order[idx + 1]
}

function statusLabel(status: CampaignStatus): string {
  if (status === 'DRAFT') return 'Borrador'
  if (status === 'SCHEDULED') return 'Programada'
  if (status === 'ACTIVE') return 'Activa'
  if (status === 'FINISHED') return 'Finalizada'
  return 'Cancelada'
}

function consentLabel(consent: CampaignContact['consent']): string {
  if (consent === 'CONSENTED') return 'Con consentimiento'
  if (consent === 'UNSUBSCRIBED') return 'Baja'
  return 'Sin registrar'
}

// SOLID: SRP - CONTROLA FORMULARIO DE CAMPANA Y ACCIONES DE CONTACTO/ENVIO.
export function CampaignDrawer({ isOpen, campaign, repository, onClose, onSaved }: CampaignDrawerProps) {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [contacts, setContacts] = useState<CampaignContact[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactsError, setContactsError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState('tpl-001')
  const [dailyLimitReached, setDailyLimitReached] = useState(false)

  useEffect(() => {
    if (!isOpen || !campaign) return
    let ignore = false
    async function loadContacts() {
      setContactsLoading(true)
      setContactsError(null)
      try {
        const result = await repository.listContacts(campaign.id, 0)
        if (!ignore) setContacts(result.items)
      } catch (err) {
        if (!ignore) setContactsError(err instanceof Error ? err.message : 'No se pudieron cargar los contactos.')
      } finally {
        if (!ignore) setContactsLoading(false)
      }
    }
    void loadContacts()
    return () => { ignore = true }
  }, [isOpen, campaign, repository])

  function reset() {
    setForm(INITIAL)
    setFieldErrors({})
    setGeneralError(null)
    setActionMessage(null)
    setActionError(null)
    setDailyLimitReached(false)
    setTemplateId('tpl-001')
  }

  function handleClose() {
    if (isSubmitting) return
    reset()
    onClose()
  }

  function validate(): CampaignInput | null {
    const errors: Record<string, string> = {}
    const name = form.name.trim()
    if (!name) errors.name = 'El nombre de la campaña es obligatorio.'
    if (form.startDate && form.endDate && form.endDate < form.startDate) errors.endDate = 'La fecha de fin no puede ser anterior al inicio.'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return null
    return { name, description: form.description.trim() || null, startDate: form.startDate || null, endDate: form.endDate || null }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setGeneralError(null)
    const input = validate()
    if (!input) return
    setIsSubmitting(true)
    try {
      const created = await repository.createCampaign(input)
      onSaved(`Campaña "${created.name}" creada correctamente.`)
      reset()
      onClose()
    } catch (err) {
      if (err instanceof MarketingApiError) setGeneralError(err.message)
      else setGeneralError('No se pudo crear la campaña.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleStatusChange(next: CampaignStatus) {
    if (!campaign) return
    setActionError(null)
    setActionMessage(null)
    try {
      const updated = await repository.updateStatus(campaign.id, next)
      onSaved(`Estado de campaña actualizado a ${statusLabel(updated.status)}.`)
      onClose()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo actualizar el estado.')
    }
  }

  async function handleConsent(customerId: string) {
    setActionError(null)
    setActionMessage(null)
    try {
      await repository.setConsent(customerId)
      setContacts((prev) => prev.map((c) => c.customerId === customerId ? { ...c, consent: 'CONSENTED' } : c))
      setActionMessage('Consentimiento registrado.')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo registrar consentimiento.')
    }
  }

  async function handleUnsubscribe(customerId: string) {
    setActionError(null)
    setActionMessage(null)
    try {
      await repository.registerUnsubscribe(customerId)
      setContacts((prev) => prev.map((c) => c.customerId === customerId ? { ...c, consent: 'UNSUBSCRIBED' } : c))
      setActionMessage('Baja registrada.')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo registrar la baja.')
    }
  }

  async function handleSend() {
    if (!campaign || dailyLimitReached) return
    setActionError(null)
    setActionMessage(null)
    setIsSubmitting(true)
    try {
      const result = await repository.sendManual(campaign.id, templateId.trim() || 'tpl-001')
      if (result.remainingToday <= 0) setDailyLimitReached(true)
      setActionMessage(`Envío completado: ${result.sent} enviados, ${result.failed} fallidos, ${result.remainingToday} restantes hoy.`)
      onSaved(`Envío manual ejecutado para "${campaign.name}".`, 20 - result.remainingToday)
    } catch (err) {
      if (err instanceof MarketingApiError && err.code === 'DAILY_LIMIT_REACHED') {
        setDailyLimitReached(true)
        setActionError('Límite diario alcanzado. No se enviaron mensajes.')
      } else {
        setActionError(err instanceof Error ? err.message : 'No se pudo completar el envío.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const title = campaign ? campaign.name : 'Nueva campaña'
  const footer = !campaign ? (
    <div className="campaign-drawer__footer">
      <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>Cancelar</Button>
      <Button type="submit" form="campaign-create-form" variant="primary" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Guardar campaña'}</Button>
    </div>
  ) : undefined

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title={title} footer={footer} panelClassName="campaign-drawer">
      {!campaign ? (
        <form id="campaign-create-form" className="campaign-drawer__form" onSubmit={handleCreate} noValidate>
          {generalError && <Alert variant="error" title="No se pudo crear la campaña">{generalError}</Alert>}
          <Input id="campaign-name" label="Nombre de la campaña" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} error={fieldErrors.name} required />
          <div className="campaign-drawer__field">
            <label className="campaign-drawer__label" htmlFor="campaign-description">Descripción</label>
            <textarea id="campaign-description" className="campaign-drawer__textarea" rows={4} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="campaign-drawer__row">
            <Input id="campaign-start-date" label="Fecha de inicio" type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
            <Input id="campaign-end-date" label="Fecha de fin" type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} error={fieldErrors.endDate} />
          </div>
        </form>
      ) : (
        <div className="campaign-drawer__detail">
          <p className="campaign-drawer__description">{campaign.description || 'Sin descripción.'}</p>
          <div className="campaign-drawer__meta">
            <span><strong>Estado:</strong> {statusLabel(campaign.status)}</span>
          </div>
          <div className="campaign-drawer__status-actions">
            {nextStatus(campaign.status) && canMoveTo(campaign.status, nextStatus(campaign.status)!) && (
              <Button variant="secondary" size="sm" onClick={() => handleStatusChange(nextStatus(campaign.status)!)}>Mover a {statusLabel(nextStatus(campaign.status)!)}</Button>
            )}
            {canMoveTo(campaign.status, 'CANCELLED') && (
              <Button variant="secondary" size="sm" onClick={() => handleStatusChange('CANCELLED')}>Cancelar campaña</Button>
            )}
          </div>

          <section className="campaign-drawer__section" aria-label="Contactos de campaña">
            <h3 className="campaign-drawer__section-title">Contactos</h3>
            {contactsLoading ? <Spinner size="sm" label="Cargando contactos..." /> : contactsError ? <Alert variant="error" title="Error al cargar contactos">{contactsError}</Alert> : contacts.length === 0 ? <EmptyState title="Sin contactos" description="No hay contactos asociados a esta campaña." /> : (
              <ul className="campaign-drawer__contacts">
                {contacts.map((contact) => (
                  <li key={contact.customerId} className="campaign-drawer__contact">
                    <div>
                      <div className="campaign-drawer__contact-name">{contact.fullName}</div>
                      <div className="campaign-drawer__contact-email">{contact.email || 'Sin correo'}</div>
                    </div>
                    <div className="campaign-drawer__contact-actions">
                      <Badge variant={contact.consent === 'CONSENTED' ? 'success' : contact.consent === 'UNSUBSCRIBED' ? 'error' : 'neutral'}>{consentLabel(contact.consent)}</Badge>
                      {contact.consent !== 'CONSENTED' && contact.consent !== 'UNSUBSCRIBED' && <Button variant="secondary" size="sm" onClick={() => handleConsent(contact.customerId)}>Otorgar consentimiento</Button>}
                      {contact.consent !== 'UNSUBSCRIBED' && <Button variant="secondary" size="sm" onClick={() => handleUnsubscribe(contact.customerId)}>Dar de baja</Button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="campaign-drawer__section" aria-label="Envío manual">
            <h3 className="campaign-drawer__section-title">Envío manual</h3>
            {actionMessage && <div role="status" className="campaign-drawer__notice">{actionMessage}</div>}
            {actionError && <Alert variant="error" title="Acción no completada">{actionError}</Alert>}
            <Input id="campaign-template-id" label="Plantilla" value={templateId} onChange={(e) => setTemplateId(e.target.value)} />
            <p className="campaign-drawer__hint">Límite diario: 20 envíos por tenant.</p>
            <Button variant="primary" onClick={handleSend} disabled={isSubmitting || dailyLimitReached || campaign.status !== 'ACTIVE'}>
              {dailyLimitReached ? 'Límite diario alcanzado' : isSubmitting ? 'Enviando...' : 'Enviar manualmente'}
            </Button>
          </section>
        </div>
      )}
    </Drawer>
  )
}
