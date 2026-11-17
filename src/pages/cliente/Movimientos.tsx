import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistorial, usePosicionGlobal } from '@/hooks/useClienteQueries';
import { Select, Skeleton } from '@/components/ui';
import { DataTable } from '@/components/shared/DataTable';
import { Pagination } from '@/components/shared/Pagination';
import { ProblemBanner } from '@/components/shared/ProblemBanner';
import { Movement } from '@/components/shared/Money';
import { formatFechaHora, maskLast4 } from '@/utils/format';

export default function Movimientos() {
  const { t } = useTranslation();
  const [pagina, setPagina] = useState(1);
  const [cuenta, setCuenta] = useState('');
  const { data: pos } = usePosicionGlobal();
  const { data, isLoading, error, refetch } = useHistorial({
    pagina,
    tamano: 20,
    id_cuenta: cuenta || undefined,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('Movimientos')}</h1>
      <div className="max-w-xs">
        <Select
          label={t('Cuenta')}
          value={cuenta}
          onChange={(e) => {
            setCuenta(e.target.value);
            setPagina(1);
          }}
        >
          <option value="">{t('Todas')}</option>
          {pos?.cuentas.map((c) => (
            <option key={c.id_cuenta} value={c.id_cuenta}>
              {maskLast4(c.numero_cuenta)}
            </option>
          ))}
        </Select>
      </div>
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : error || !data ? (
        <ProblemBanner error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <DataTable
            caption={t('Historial de movimientos')}
            rows={data.items}
            rowKey={(m) => m.id_transaccion}
            columns={[
              { header: t('Fecha'), cell: (m) => <span className="num">{formatFechaHora(m.fecha)}</span> },
              { header: t('Concepto'), cell: (m) => m.concepto },
              { header: t('Valor'), align: 'right', cell: (m) => <Movement tipo={m.tipo} monto={m.monto} /> },
            ]}
          />
          <Pagination pagina={data.pagina} totalPaginas={data.total_paginas} onChange={setPagina} />
        </>
      )}
    </div>
  );
}
