import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarketingPage } from './MarketingPage'
import type { MarketingRepository } from '../services'
import { MarketingApiError } from '../services'
import type { Campaign, CampaignPage, ContactPage, SendResult } from '../types/marketing'
import { cleanupSessionTestState, renderWithProviders } from '../../../test/renderWithProviders'

function makeCampaign(id: string, name: string, status: Campaign['status']): Campaign {
  return { id, name, description: null, startDate: '2026-11-01', endDate: '2026-11-30', status, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z' }
}

class TestRepo implements MarketingRepository {
  campaigns = [makeCampaign('c1', 'Campaña Activa', 'ACTIVE'), makeCampaign('c2', 'Campaña Borrador', 'DRAFT')]
  contacts = [{ customerId: 'u1', fullName: 'Ana Demo', email: 'ana@demo.test', consent: 'NONE' as const }]
  sendManual = vi.fn(async () => ({ sent: 1, failed: 0, remainingToday: 19 } as SendResult))
  async listCampaigns(filters: { status?: string } = {}, page = 0): Promise<CampaignPage> {
    let items = [...this.campaigns]
    if (filters.status) items = items.filter((c) => c.status === filters.status)
    return { items: items.slice(page * 5, page * 5 + 5), page, size: 5, hasNext: false }
  }
  async getCampaign(id: string): Promise<Campaign> { return this.campaigns.find((c) => c.id === id)! }
  async createCampaign(): Promise<Campaign> { return this.campaigns[0] }
  async updateStatus(): Promise<Campaign> { return this.campaigns[0] }
  async listContacts(): Promise<ContactPage> { return { items: this.contacts.map((c) => ({ ...c })), page: 0, size: 5, hasNext: false } }
  async setConsent(customerId: string): Promise<void> { this.contacts = this.contacts.map((c) => c.customerId === customerId ? { ...c, consent: 'CONSENTED' } : c) }
  async registerUnsubscribe(customerId: string): Promise<void> { this.contacts = this.contacts.map((c) => c.customerId === customerId ? { ...c, consent: 'UNSUBSCRIBED' } : c) }
}

describe('MarketingPage', () => {
  afterEach(() => { cleanupSessionTestState() })

  it('carga campañas y métricas', async () => {
    renderWithProviders(<MarketingPage repository={new TestRepo()} />, { initialPath: '/marketing' })
    expect(screen.getByRole('heading', { level: 1, name: 'Marketing' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Campaña Activa')).toBeInTheDocument())
    expect(screen.getByText('Envíos del día')).toBeInTheDocument()
  })

  it('filtra por estado', async () => {
    const user = userEvent.setup()
    renderWithProviders(<MarketingPage repository={new TestRepo()} />, { initialPath: '/marketing' })
    await waitFor(() => expect(screen.getByText('Campaña Activa')).toBeInTheDocument())
    await user.click(screen.getByRole('tab', { name: /^Activa/i }))
    await waitFor(() => {
      expect(screen.getByText('Campaña Activa')).toBeInTheDocument()
      expect(screen.queryByText('Campaña Borrador')).not.toBeInTheDocument()
    })
  })

  it('muestra error seguro de servicio no disponible', async () => {
    const repo: MarketingRepository = {
      listCampaigns: vi.fn().mockRejectedValue(new MarketingApiError('Servicio no disponible', 'service_unavailable')),
      getCampaign: vi.fn(), createCampaign: vi.fn(), updateStatus: vi.fn(), listContacts: vi.fn(), setConsent: vi.fn(), registerUnsubscribe: vi.fn(), sendManual: vi.fn(),
    }
    renderWithProviders(<MarketingPage repository={repo} />, { initialPath: '/marketing' })
    await waitFor(() => expect(screen.getByText(/servicio de marketing no disponible temporalmente/i)).toBeInTheDocument())
  })

  it('gestiona límite diario, baja y envío fallido', async () => {
    const user = userEvent.setup()
    const repo = new TestRepo()
    repo.sendManual = vi.fn()
      .mockRejectedValueOnce(new MarketingApiError('Fallo envío', 'unknown'))
      .mockResolvedValueOnce({ sent: 2, failed: 0, remainingToday: 0 })
    renderWithProviders(<MarketingPage repository={repo} />, { initialPath: '/marketing' })
    await waitFor(() => expect(screen.getByText('Campaña Activa')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /ver campaña campaña activa/i }))
    const dialog = await screen.findByRole('dialog', { name: /campaña activa/i })
    await waitFor(() => expect(within(dialog).getByText('Ana Demo')).toBeInTheDocument())
    await user.click(within(dialog).getByRole('button', { name: /dar de baja/i }))
    await waitFor(() => expect(within(dialog).getByText(/baja registrada/i)).toBeInTheDocument())
    await user.click(within(dialog).getByRole('button', { name: /enviar manualmente/i }))
    await waitFor(() => expect(within(dialog).getByText(/fallo envío/i)).toBeInTheDocument())
    await user.click(within(dialog).getByRole('button', { name: /enviar manualmente/i }))
    await waitFor(() => expect(within(dialog).getByText(/límite diario alcanzado/i)).toBeInTheDocument())
  }, 5000)
})
