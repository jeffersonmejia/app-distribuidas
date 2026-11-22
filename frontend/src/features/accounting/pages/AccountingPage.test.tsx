import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccountingPage } from './AccountingPage'
import type { AccountingRepository } from '../services'
import type { AccountingSummary, JournalEntry, JournalEntryFilters, JournalEntryPage } from '../types/accounting'
import { cleanupSessionTestState, renderWithProviders } from '../../../test/renderWithProviders'

class FastAccountingRepo implements AccountingRepository {
  private entries: JournalEntry[]

  constructor(entries?: JournalEntry[]) {
    this.entries = (entries ?? [
      {
        id: 'je-1',
        code: 'AS-2026-0412',
        date: '2026-11-18',
        glosa: 'Cobro de factura',
        status: 'POSTED',
        lines: [
          { id: 'l1', accountCode: '1.1.01.001', accountName: 'Caja general', debitCents: 125000, creditCents: 0 },
          { id: 'l2', accountCode: '1.1.02.003', accountName: 'Cuentas por cobrar clientes', debitCents: 0, creditCents: 125000 },
        ],
        createdAt: '2026-11-18T12:00:00.000Z',
        updatedAt: '2026-11-18T12:00:00.000Z',
      },
      {
        id: 'je-2',
        code: 'AS-2026-0413',
        date: '2026-11-17',
        glosa: 'Pago de nómina',
        status: 'PENDING',
        lines: [
          { id: 'l3', accountCode: '5.2.01.001', accountName: 'Sueldos y salarios', debitCents: 384000, creditCents: 0 },
          { id: 'l4', accountCode: '1.1.01.002', accountName: 'Bancos cuenta corriente', debitCents: 0, creditCents: 384000 },
        ],
        createdAt: '2026-11-17T12:00:00.000Z',
        updatedAt: '2026-11-17T12:00:00.000Z',
      },
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `je-extra-${i + 1}`,
        code: `AS-2026-050${i + 1}`,
        date: `2026-10-${String(10 + i).padStart(2, '0')}`,
        glosa: `Asiento extra ${i + 1}`,
        status: 'POSTED' as const,
        lines: [
          { id: `e${i}-d`, accountCode: '1.1.01.001', accountName: 'Caja general', debitCents: 1000, creditCents: 0 },
          { id: `e${i}-c`, accountCode: '4.1.01.001', accountName: 'Ingresos por ventas', debitCents: 0, creditCents: 1000 },
        ],
        createdAt: `2026-10-${String(10 + i).padStart(2, '0')}T12:00:00.000Z`,
        updatedAt: `2026-10-${String(10 + i).padStart(2, '0')}T12:00:00.000Z`,
      })),
    ]).map((entry) => ({ ...entry, lines: entry.lines.map((line) => ({ ...line })) }))
  }

  async listEntries(filters: JournalEntryFilters = {}, page = 0): Promise<JournalEntryPage> {
    let items = this.entries.map((e) => ({ ...e, lines: e.lines.map((l) => ({ ...l })) }))
    const search = filters.search?.trim().toLowerCase()
    if (search) {
      items = items.filter(
        (e) =>
          e.code.toLowerCase().includes(search) ||
          e.glosa.toLowerCase().includes(search) ||
          e.lines.some((l) => l.accountName.toLowerCase().includes(search) || l.accountCode.includes(search))
      )
    }
    if (filters.period) items = items.filter((e) => e.date.startsWith(filters.period!))
    const start = page * 5
    return { items: items.slice(start, start + 5), page, size: 5, hasNext: start + 5 < items.length }
  }

  async getEntry(id: string): Promise<JournalEntry> {
    const entry = this.entries.find((e) => e.id === id)
    if (!entry) throw new Error('No encontrado')
    return { ...entry, lines: entry.lines.map((l) => ({ ...l })) }
  }

  async getSummary(): Promise<AccountingSummary> {
    return {
      totalEntries: this.entries.length,
      totalDebitCents: this.entries.reduce((sum, e) => sum + e.lines.reduce((s, l) => s + l.debitCents, 0), 0),
      totalCreditCents: this.entries.reduce((sum, e) => sum + e.lines.reduce((s, l) => s + l.creditCents, 0), 0),
      pendingEntries: this.entries.filter((e) => e.status === 'PENDING').length,
    }
  }
}

describe('AccountingPage', () => {
  afterEach(() => {
    cleanupSessionTestState()
  })

  it('renderiza encabezado, métricas y tabla de asientos', async () => {
    renderWithProviders(<AccountingPage repository={new FastAccountingRepo()} />, { initialPath: '/accounting' })

    expect(screen.getByRole('heading', { level: 1, name: 'Contabilidad' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('AS-2026-0412')).toBeInTheDocument()
      expect(screen.getByText('Cobro de factura')).toBeInTheDocument()
    })
    expect(screen.getByText('Asientos')).toBeInTheDocument()
    expect(screen.getByText('Total debe')).toBeInTheDocument()
    expect(screen.getByText('Total haber')).toBeInTheDocument()
    expect(screen.getByText('Pendientes')).toBeInTheDocument()
  })

  it('no muestra controles de creación o modificación', async () => {
    renderWithProviders(<AccountingPage repository={new FastAccountingRepo()} />, { initialPath: '/accounting' })
    await waitFor(() => expect(screen.getByText('AS-2026-0412')).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: /nuevo asiento|crear asiento|registrar asiento/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /guardar asiento|editar|eliminar/i })).not.toBeInTheDocument()
  })

  it('permite buscar y filtrar por período', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AccountingPage repository={new FastAccountingRepo()} />, { initialPath: '/accounting' })
    await waitFor(() => expect(screen.getByText('AS-2026-0412')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText(/buscar por código, glosa o cuenta/i), 'nómina')
    await waitFor(() => {
      expect(screen.getByText('Pago de nómina')).toBeInTheDocument()
      expect(screen.queryByText('Cobro de factura')).not.toBeInTheDocument()
    })

    await user.clear(screen.getByPlaceholderText(/buscar por código, glosa o cuenta/i))
    await waitFor(() => expect(screen.getByText('Cobro de factura')).toBeInTheDocument())

    await user.selectOptions(screen.getByLabelText(/seleccionar período contable/i), '2026-10')
    await waitFor(() => {
      expect(screen.getByText('Asiento extra 1')).toBeInTheDocument()
      expect(screen.queryByText('Cobro de factura')).not.toBeInTheDocument()
    })
  })

  it('pagina los asientos', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AccountingPage repository={new FastAccountingRepo()} />, { initialPath: '/accounting' })
    await waitFor(() => expect(screen.getByText('AS-2026-0412')).toBeInTheDocument())
    expect(screen.queryByText('Asiento extra 4')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /ir a página siguiente/i }))
    await waitFor(() => {
      expect(screen.getByText('Asiento extra 4')).toBeInTheDocument()
    })
  })

  it('abre drawer de detalle con cuadre', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AccountingPage repository={new FastAccountingRepo()} />, { initialPath: '/accounting' })
    await waitFor(() => expect(screen.getByText('AS-2026-0412')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /ver detalle de AS-2026-0412/i }))
    const dialog = await screen.findByRole('dialog', { name: /detalle de asiento/i })
    expect(within(dialog).getByText('AS-2026-0412')).toBeInTheDocument()
    expect(within(dialog).getByText('Verificación de cuadre: asiento balanceado.')).toBeInTheDocument()
    expect(within(dialog).getAllByText('1.250,00').length).toBeGreaterThan(0)
  })

  it('muestra estado vacío, error y reintento', async () => {
    const user = userEvent.setup()
    const failingRepo: AccountingRepository = {
      listEntries: vi.fn().mockRejectedValueOnce(new Error('Fallo contable')).mockResolvedValue({ items: [], page: 0, size: 5, hasNext: false }),
      getEntry: vi.fn(),
      getSummary: vi.fn().mockResolvedValue({ totalEntries: 0, totalDebitCents: 0, totalCreditCents: 0, pendingEntries: 0 }),
    }

    renderWithProviders(<AccountingPage repository={failingRepo} />, { initialPath: '/accounting' })
    await waitFor(() => expect(screen.getByText(/error al cargar contabilidad/i)).toBeInTheDocument())
    expect(screen.getByText(/fallo contable/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /reintentar/i }))
    await waitFor(() => expect(screen.getByText(/sin asientos contables/i)).toBeInTheDocument())
  })

  it('respeta aislamiento por tenant mediante repositorio', async () => {
    const pacificoRepo = new FastAccountingRepo([
      {
        id: 'je-pacifico-001',
        code: 'AS-2026-0201',
        date: '2026-11-18',
        glosa: 'Asiento Pacífico',
        status: 'POSTED',
        lines: [
          { id: 'p1', accountCode: '1.1.01.001', accountName: 'Caja general', debitCents: 100, creditCents: 0 },
          { id: 'p2', accountCode: '4.1.01.001', accountName: 'Ingresos por ventas', debitCents: 0, creditCents: 100 },
        ],
        createdAt: '2026-11-18T12:00:00.000Z',
        updatedAt: '2026-11-18T12:00:00.000Z',
      },
    ])

    renderWithProviders(<AccountingPage repository={pacificoRepo} />, { initialPath: '/accounting' })
    await waitFor(() => expect(screen.getByText('AS-2026-0201')).toBeInTheDocument())
    expect(screen.queryByText('AS-2026-0412')).not.toBeInTheDocument()
  })
})
