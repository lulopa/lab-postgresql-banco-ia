import { redactSensitive } from '@/utils/validators';

/** Visor de payloads JSONB. Se renderiza como texto (sin HTML) y redacta claves sensibles. */
export function JsonViewer({ value, label }: { value: unknown; label: string }) {
  return (
    <figure>
      <figcaption className="mb-1 text-xs font-medium text-muted">{label}</figcaption>
      <pre className="num max-h-64 overflow-auto rounded-lg border border-line bg-app p-3 text-xs text-fg">
        {value == null ? 'null' : JSON.stringify(redactSensitive(value), null, 2)}
      </pre>
    </figure>
  );
}
