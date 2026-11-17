import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBitacora } from '@/hooks/useAuditoriaQueries';
import { Badge, Button, Input, Skeleton, type Tone } from '@/components/ui';
import { DataTable } from '@/components/shared/DataTable';
import { Pagination } from '@/components/shared/Pagination';
import { ProblemBanner } from '@/components/shared/ProblemBanner';
import { JsonViewer } from '@/components/shared/JsonViewer';
import { formatFechaHora } from '@/utils/format';
import type { BitacoraEntrada, BitacoraFiltros, OperacionAuditoria } from '@/contracts';

const TONO: Record<OperacionAuditoria, Tone> = { INSERT: 'success', UPDATE: 'info', DELETE: 'danger' };

export default function Bitacora() {
  const { t } = useTranslation();
  const [draft, setDraft] = useState({ desde: '', hasta: '', tabla: '', usuario: '' });
  const [filtros, setFiltros] = useState<BitacoraFiltros>({ pagina: 1, tamano: 20 });
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = useBitacora(filtros);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('Bitácora de auditoría')}</h1>
      <form
        className="grid gap-3 rounded-xl border border-line bg-card p-4 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          setFiltros({ ...draft, pagina: 1, tamano: 20 });
        }}
      >
        <Input
          label={t('Desde')}
          type="date"
          value={draft.desde}
          onChange={(e) => setDraft({ ...draft, desde: e.target.value })}
        />
        <Input
          label={t('Hasta')}
          type="date"
          value={draft.hasta}
          onChange={(e) => setDraft({ ...draft, hasta: e.target.value })}
        />
        <Input
          label={t('Tabla')}
          value={draft.tabla}
          onChange={(e) => setDraft({ ...draft, tabla: e.target.value })}
        />
        <Input
          label={t('Usuario')}
          value={draft.usuario}
          onChange={(e) => setDraft({ ...draft, usuario: e.target.value })}
        />
        <div className="flex items-end">
          <Button type="submit" className="w-full">
            {t('Filtrar')}
          </Button>
        </div>
      </form>
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : error || !data ? (
        <ProblemBanner error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <DataTable<BitacoraEntrada>
            caption={t('Eventos de auditoría')}
            rows={data.items}
            rowKey={(e) => String(e.id_auditoria)}
            columns={[
              { header: t('Fecha'), cell: (e) => <span className="num">{formatFechaHora(e.fecha)}</span> },
              { header: t('Operación'), cell: (e) => <Badge tone={TONO[e.operacion]}>{e.operacion}</Badge> },
              { header: t('Tabla'), cell: (e) => <span className="num">{e.tabla}</span> },
              { header: t('Usuario'), cell: (e) => e.usuario },
              {
                header: t('Detalle'),
                cell: (e) => {
                  const id = String(e.id_auditoria);
                  const isOpen = open === id;
                  return (
                    <div>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpen(isOpen ? null : id)}
                        className="inline-flex items-center gap-1 font-medium text-brand-text"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" aria-hidden />
                        ) : (
                          <ChevronRight className="h-4 w-4" aria-hidden />
                        )}
                        {t('Ver payload')}
                      </button>
                      {isOpen && (
                        <div className="mt-2 grid gap-2 lg:grid-cols-2">
                          <JsonViewer label={t('Antes')} value={e.payload_anterior} />
                          <JsonViewer label={t('Después')} value={e.payload_nuevo} />
                        </div>
                      )}
                    </div>
                  );
                },
              },
            ]}
          />
          <Pagination
            pagina={data.pagina}
            totalPaginas={data.total_paginas}
            onChange={(p) => setFiltros({ ...filtros, pagina: p })}
          />
        </>
      )}
    </div>
  );
}
