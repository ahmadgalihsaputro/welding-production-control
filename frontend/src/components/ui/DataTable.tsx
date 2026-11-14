import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface Column<T> {
  key: string
  header: string
  render: (row: T, index: number) => ReactNode
  align?: 'left' | 'right' | 'center'
  width?: string
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  minWidth?: number
  compact?: boolean
  emptyMessage?: string
  footer?: ReactNode
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  minWidth = 640,
  compact = false,
  emptyMessage = 'Belum ada data untuk ditampilkan.',
  footer,
}: DataTableProps<T>) {
  return (
    <>
      <div className="table-wrap">
        <table
          className={cn('data-table', compact && 'table-compact')}
          style={{ minWidth }}
        >
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={column.className}
                  style={{
                    width: column.width,
                    textAlign: column.align ?? 'left',
                  }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '30px 16px' }}>
                  <span className="muted small">{emptyMessage}</span>
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={rowKey(row)}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={column.className}
                      style={{ textAlign: column.align ?? 'left' }}
                    >
                      {column.render(row, index)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer && <div className="table-footer">{footer}</div>}
    </>
  )
}
