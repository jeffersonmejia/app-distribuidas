import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Table } from './Table'

describe('Table Component', () => {
  const columns = [
    { key: 'name', label: 'Nombre' },
    { key: 'email', label: 'Correo' },
    { key: 'status', label: 'Estado', align: 'center' as const },
  ]

  it('renderiza encabezados de columna con scope="col"', () => {
    render(
      <Table columns={columns} ariaLabel="Tabla de prueba">
        <tr>
          <td>Juan Pérez</td>
          <td>juan@example.com</td>
          <td>Activo</td>
        </tr>
      </Table>
    )

    const table = screen.getByRole('table', { name: 'Tabla de prueba' })
    expect(table).toBeInTheDocument()

    const headers = screen.getAllByRole('columnheader')
    expect(headers).toHaveLength(3)
    expect(headers[0]).toHaveTextContent('Nombre')
    expect(headers[0]).toHaveAttribute('scope', 'col')
    expect(headers[2]).toHaveClass('app-table__th--center')
  })

  it('renderiza filas y celdas correctamente', () => {
    render(
      <Table columns={columns}>
        <tr>
          <td>Ana Gómez</td>
          <td>ana@example.com</td>
          <td>Activo</td>
        </tr>
      </Table>
    )

    expect(screen.getByText('Ana Gómez')).toBeInTheDocument()
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
  })

  it('renderiza la leyenda caption cuando se proporciona', () => {
    render(
      <Table columns={columns} caption="Lista de clientes">
        <tr><td>Data</td></tr>
      </Table>
    )
    expect(screen.getByText('Lista de clientes')).toBeInTheDocument()
  })
})
