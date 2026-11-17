import type { Meta, StoryObj } from '@storybook/react';
import { DataTable } from './DataTable';
import { Movement } from './Money';

interface Fila {
  id: string;
  fecha: string;
  concepto: string;
  tipo: 'DEBITO' | 'CREDITO';
  monto: number;
}
const filas: Fila[] = [
  { id: '1', fecha: '15 nov 2026', concepto: 'Transferencia', tipo: 'DEBITO', monto: 50000 },
  { id: '2', fecha: '14 nov 2026', concepto: 'Consignación', tipo: 'CREDITO', monto: 150000 },
];

const meta = {
  title: 'Compartidos/DataTable',
  component: DataTable<Fila>,
  tags: ['autodocs'],
} satisfies Meta<typeof DataTable<Fila>>;
export default meta;
type S = StoryObj<typeof meta>;

const columns = [
  { header: 'Fecha', cell: (r: Fila) => r.fecha },
  { header: 'Concepto', cell: (r: Fila) => r.concepto },
  { header: 'Valor', align: 'right' as const, cell: (r: Fila) => <Movement tipo={r.tipo} monto={r.monto} /> },
];
export const ConDatos: S = {
  args: { caption: 'Historial de movimientos', columns, rows: filas, rowKey: (r) => r.id },
};
export const Vacia: S = {
  args: { caption: 'Historial de movimientos', columns, rows: [], rowKey: (r) => r.id },
};
