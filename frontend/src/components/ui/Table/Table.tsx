import type { ReactNode } from 'react'
import './Table.css'

//SOLID: SRP — RENDERIZA UNA TABLA SEMÁNTICA ACCESIBLE CON EL ESTILO DE FILAS DE STITCH.

export interface TableColumn {
  key: string
  label: string
  align?: 'left' | 'center' | 'right'
}

export interface TableProps {
  columns: TableColumn[]
  children: ReactNode
  ariaLabel?: string
  caption?: string
}

export function Table({ columns, children, ariaLabel, caption }: TableProps) {
  return (
    <div className="table-container">
      <table className="app-table" aria-label={ariaLabel}>
        {caption && <caption className="app-table__caption">{caption}</caption>}
        <thead className="app-table__head">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`app-table__th app-table__th--${col.align ?? 'left'}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="app-table__body">{children}</tbody>
      </table>
    </div>
  )
}
