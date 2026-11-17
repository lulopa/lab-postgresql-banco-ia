import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'right';
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  empty,
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (r: T) => string;
  empty?: string;
}) {
  const { t } = useTranslation();
  if (rows.length === 0)
    return (
      <p className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">
        {empty ?? t('No hay registros para mostrar.')}
      </p>
    );
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-card">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line text-muted">
          <tr>
            {columns.map((c) => (
              <th
                key={c.header}
                scope="col"
                className={`px-4 py-3 font-medium ${c.align === 'right' ? 'text-right' : ''}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="border-b border-line last:border-0">
              {columns.map((c) => (
                <td key={c.header} className={`px-4 py-3 ${c.align === 'right' ? 'num text-right' : ''}`}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
