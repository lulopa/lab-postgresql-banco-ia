import { useTranslation } from 'react-i18next';
import { ApiError } from '@/services/apiClient';
import { Button } from './Button';
import { Modal } from './Modal';

/** Modal de errores RFC 7807 (documento §5.4): estado, título, detalle y código de error. */
export function ProblemModal({ error, onClose }: { error: Error | null; onClose: () => void }) {
  const { t } = useTranslation();
  if (!error) return null;
  const p =
    error instanceof ApiError
      ? error.problem
      : {
          estado: 0,
          titulo: t('Error inesperado'),
          detalle: t('Intenta de nuevo.'),
          codigo_error: 'CLIENT_ERROR',
          errores: undefined,
        };
  return (
    <Modal
      open
      title={p.titulo}
      onClose={onClose}
      footer={<Button onClick={onClose}>{t('Entendido')}</Button>}
    >
      <p>{p.detalle}</p>
      {p.errores && (
        <ul className="mt-2 list-disc pl-5">
          {Object.entries(p.errores).flatMap(([campo, msgs]) =>
            msgs.map((m) => (
              <li key={`${campo}${m}`}>
                {campo}: {m}
              </li>
            )),
          )}
        </ul>
      )}
      <p className="num mt-3 text-xs text-muted">
        {t('Código {{codigo}} · Estado {{estado}}', { codigo: p.codigo_error, estado: p.estado })}
      </p>
    </Modal>
  );
}
