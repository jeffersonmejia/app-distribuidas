import { describe, it, expect, beforeEach } from 'vitest'
import {
  MarketingMockRepository,
  resetMarketingMockStore,
  MarketingApiError,
  getMarketingRepository,
  setMarketingRepositoryForTesting,
} from './index'

describe('MarketingMockRepository', () => {
  let repo: MarketingMockRepository

  beforeEach(() => {
    resetMarketingMockStore()
    repo = new MarketingMockRepository()
  })

  it('lista campañas paginadas con tamaño máximo de 5 y filtro por estado', async () => {
    const page0 = await repo.listCampaigns({}, 0)
    expect(page0.size).toBe(5)
    expect(page0.items.length).toBe(5)
    expect(page0.hasNext).toBe(true)

    const page1 = await repo.listCampaigns({}, 1)
    expect(page1.items.length).toBe(1)
    expect(page1.hasNext).toBe(false)

    const active = await repo.listCampaigns({ status: 'ACTIVE' })
    expect(active.items.length).toBe(1)
    expect(active.items[0].status).toBe('ACTIVE')
  })

  it('crea una campaña y valida campos obligatorios', async () => {
    await expect(repo.createCampaign({ name: '   ' })).rejects.toMatchObject({ kind: 'validation' })

    const created = await repo.createCampaign({
      name: 'Campaña nueva',
      description: 'Descripción',
      startDate: '2026-11-20',
      endDate: '2026-11-30',
    })
    expect(created.name).toBe('Campaña nueva')
    expect(created.status).toBe('DRAFT')
  })

  it('aplica transiciones de estado válidas y rechaza inválidas', async () => {
    const draft = (await repo.listCampaigns({ status: 'DRAFT' })).items[0]

    await expect(repo.updateStatus(draft.id, 'ACTIVE')).rejects.toMatchObject({
      kind: 'conflict',
      code: 'INVALID_CAMPAIGN_TRANSITION',
    })

    const scheduled = await repo.updateStatus(draft.id, 'SCHEDULED')
    expect(scheduled.status).toBe('SCHEDULED')

    const active = await repo.updateStatus(draft.id, 'ACTIVE')
    expect(active.status).toBe('ACTIVE')
  })

  it('lista contactos derivados de clientes CRM activos con consentimiento y pagina', async () => {
    const page = await repo.listContacts('cmp-andina-001', 0)
    expect(page.items.length).toBe(5)
    expect(page.items.every((c) => c.customerId.startsWith('mock-andina-'))).toBe(true)
    const carlos = page.items.find((c) => c.customerId === 'mock-andina-00000001')
    expect(carlos?.consent).toBe('CONSENTED')
    expect(carlos?.fullName).toBe('Carlos Alberto Mendoza')
  })

  it('gestiona consentimiento y rechaza consentir a un contacto dado de baja', async () => {
    await repo.setConsent('mock-andina-00000005')
    const contacts = await repo.listContacts('cmp-andina-001', 0)
    expect(contacts.items.find((c) => c.customerId === 'mock-andina-00000005')?.consent).toBe('CONSENTED')

    await repo.registerUnsubscribe('mock-andina-00000004')
    await expect(repo.setConsent('mock-andina-00000004')).rejects.toMatchObject({
      kind: 'conflict',
      code: 'CONTACT_UNSUBSCRIBED',
    })
  })

  it('envía manualmente con límite diario de 20 y rechaza al superarlo', async () => {
    await repo.setConsent('mock-andina-00000005')
    await repo.setConsent('mock-andina-00000006')

    const first = await repo.sendManual('cmp-andina-001', 'tpl-001')
    expect(first.sent).toBe(3)
    expect(first.failed).toBe(0)
    expect(first.remainingToday).toBe(17)

    const second = await repo.sendManual('cmp-andina-001', 'tpl-001')
    expect(second.sent).toBe(0)
    expect(second.remainingToday).toBe(17)

    let remaining = 17
    let tpl = 2
    while (remaining > 0) {
      const result = await repo.sendManual('cmp-andina-001', `tpl-${String(tpl).padStart(3, '0')}`)
      remaining = result.remainingToday
      tpl += 1
    }
    expect(remaining).toBe(0)

    await expect(repo.sendManual('cmp-andina-001', 'tpl-final')).rejects.toMatchObject({
      kind: 'conflict',
      code: 'DAILY_LIMIT_REACHED',
    })

    const draft = (await repo.listCampaigns({ status: 'DRAFT' })).items[0]
    await expect(repo.sendManual(draft.id, 'tpl-001')).rejects.toMatchObject({
      kind: 'conflict',
      code: 'CAMPAIGN_NOT_ACTIVE',
    })
  })

  it('mantiene aislamiento por tenant', async () => {
    const pacifico = new MarketingMockRepository('tnt-pacifico-002')
    const andinaList = await repo.listCampaigns()
    const pacificoList = await pacifico.listCampaigns()
    expect(andinaList.items.some((c) => c.id.startsWith('cmp-andina-'))).toBe(true)
    expect(pacificoList.items.every((c) => c.id.startsWith('cmp-pacifico-'))).toBe(true)
    expect(pacificoList.items.some((c) => c.id.startsWith('cmp-andina-'))).toBe(false)
  })
})

describe('getMarketingRepository', () => {
  beforeEach(() => {
    setMarketingRepositoryForTesting(null)
  })

  it('rechaza con error seguro cuando la fuente es api', async () => {
    const original = import.meta.env.VITE_DATA_SOURCE
    import.meta.env.VITE_DATA_SOURCE = 'api'
    setMarketingRepositoryForTesting(null)
    const apiRepo = getMarketingRepository()
    await expect(apiRepo.listCampaigns()).rejects.toSatisfy((err: unknown) => {
      return err instanceof MarketingApiError && err.kind === 'service_unavailable'
    })
    import.meta.env.VITE_DATA_SOURCE = original
  })
})
