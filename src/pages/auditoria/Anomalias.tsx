import { useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDivisas, useDurmientes, useRafagas } from '@/hooks/useAuditoriaQueries';
import { Badge, Skeleton } from '@/components/ui';
import { DataTable } from '@/components/shared/DataTable';
import { ProblemBanner } from '@/components/shared/ProblemBanner';
import { JsonViewer } from '@/components/shared/JsonViewer';
import { Money } from '@/components/shared/Money';
import { formatFecha, formatFechaHora, formatMoneda, maskLast4 } from '@/utils/format';
import { VENTANA_RAFAGA_SEGUNDOS } from '@/contracts';

type Tab = 'divisas' | 'rafagas' | 'durmientes';
const TABS: { id: Tab; label: string }[] = [
  { id: 'divisas', label: 'Divisas' },
  { id: 'rafagas', label: 'Ráfagas' },
  { id: 'durmientes', label: 'Inactivas' },
];

function Divisas() {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useDivisas({ pagina: 1, tamano: 50 });
  if (isLoading) return <Skeleton className="h-48" />;
  if (error || !data) return <ProblemBanner error={error} onRetry={() => void refetch()} />;
  return (
    <DataTable
      caption={t('Operaciones en moneda distinta a COP')}
      rows={data.items}
      rowKey={(r) => String(r.id_auditoria)}
      empty={t('No se detectaron operaciones en divisas.')}
      columns={[
        { header: t('Fecha'), cell: (r) => <span className="num">{formatFechaHora(r.fecha)}</span> },
        { header: t('Usuario'), cell: (r) => r.usuario },
        { header: t('Moneda'), cell: (r) => <Badge tone="warning">{r.moneda}</Badge> },
        { header: t('Monto'), align: 'right', cell: (r) => formatMoneda(r.monto, r.moneda) },
        { header: t('Payload'), cell: (r) => <JsonViewer label={r.tabla} value={r.payload} /> },
      ]}
    />
  );
}

function Rafagas() {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useRafagas();
  if (isLoading) return <Skeleton className="h-48" />;
  if (error || !data) return <ProblemBanner error={error} onRetry={() => void refetch()} />;
  return (
    <>
      <p className="mb-3 text-sm text-muted">
        {t('Transacciones consecutivas en menos de {{s}} segundos sobre la misma cuenta.', {
          s: data.ventana_segundos || VENTANA_RAFAGA_SEGUNDOS,
        })}
      </p>
      <DataTable
        caption={t('Ráfagas de transacciones')}
        rows={data.items}
        rowKey={(r) => `${r.id_cuenta}${r.primera}`}
        empty={t('No se detectaron ráfagas.')}
        columns={[
          { header: t('Cuenta'), cell: (r) => <span className="num">{maskLast4(r.numero_cuenta)}</span> },
          { header: t('Transacciones'), align: 'right', cell: (r) => r.cantidad },
          { header: t('Inicio'), cell: (r) => <span className="num">{formatFechaHora(r.primera)}</span> },
          { header: t('Fin'), cell: (r) => <span className="num">{formatFechaHora(r.ultima)}</span> },
          { header: t('Total'), align: 'right', cell: (r) => <Money value={r.monto_total} /> },
        ]}
      />
    </>
  );
}

function Durmientes() {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useDurmientes({ pagina: 1, tamano: 50 });
  if (isLoading) return <Skeleton className="h-48" />;
  if (error || !data) return <ProblemBanner error={error} onRetry={() => void refetch()} />;
  return (
    <>
      {/* rol_auditor es de solo lectura en la BD: la reactivación la hace el Portal Operativo (Eventos de cuenta). */}
      <p className="mb-3 text-sm text-muted">
        {t('Cuentas sin movimientos por más de 6 meses. La reactivación la registra el equipo operativo.')}
      </p>
      <DataTable
        caption={t('Cuentas inactivas')}
        rows={data.items}
        rowKey={(r) => r.id_cuenta}
        empty={t('No hay cuentas inactivas.')}
        columns={[
          { header: t('Cuenta'), cell: (r) => <span className="num">{maskLast4(r.numero_cuenta)}</span> },
          {
            header: t('Última actividad'),
            cell: (r) => <span className="num">{formatFecha(r.ultima_actividad)}</span>,
          },
          { header: t('Días inactiva'), align: 'right', cell: (r) => r.dias_inactiva },
        ]}
      />
    </>
  );
}

export default function Anomalias() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('divisas');
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  /** Patrón WAI-ARIA de pestañas: flechas, Inicio y Fin mueven el foco y la selección. */
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = TABS.length - 1;
    const target =
      e.key === 'ArrowRight'
        ? i === last
          ? 0
          : i + 1
        : e.key === 'ArrowLeft'
          ? i === 0
            ? last
            : i - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null;
    if (target === null) return;
    e.preventDefault();
    const next = TABS[target];
    if (!next) return;
    setTab(next.id);
    refs.current[next.id]?.focus();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('Anomalías')}</h1>
      <div role="tablist" aria-label={t('Tipo de anomalía')} className="flex gap-1 border-b border-line">
        {TABS.map((x, i) => (
          <button
            key={x.id}
            ref={(el) => {
              refs.current[x.id] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${x.id}`}
            aria-selected={tab === x.id}
            aria-controls="panel"
            tabIndex={tab === x.id ? 0 : -1}
            onClick={() => setTab(x.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`min-h-[44px] px-4 text-sm font-semibold ${tab === x.id ? 'border-b-2 border-brand text-fg' : 'text-muted'}`}
          >
            {t(x.label)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="panel" aria-labelledby={`tab-${tab}`} tabIndex={0}>
        {tab === 'divisas' && <Divisas />}
        {tab === 'rafagas' && <Rafagas />}
        {tab === 'durmientes' && <Durmientes />}
      </div>
    </div>
  );
}
