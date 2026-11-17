import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { contrastRatio } from '@/utils/contrast';

const meta = {
  title: 'Design System/Tokens',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Tokens de color "AMAZON BIRDS" (documento §2.2) y variantes derivadas. La relación de contraste se calcula en vivo desde las variables CSS del tema activo (claro/oscuro).',
      },
    },
  },
} satisfies Meta;
export default meta;

const MARCA = [
  ['--color-calgar-blue', 'Primario / marca (relleno)'],
  ['--color-tail-lights', 'Crítico (solo decorativo: no cumple como texto)'],
  ['--color-krypton-green', 'Éxito (relleno)'],
  ['--color-sunny-yellow', 'Advertencia (solo con texto oscuro)'],
] as const;
const DERIVADOS = [
  ['--brand-text', 'Texto/enlaces de marca', '--bg-card'],
  ['--danger-text', 'Texto de error y débitos', '--bg-card'],
  ['--success-text', 'Texto de éxito y créditos', '--bg-card'],
  ['--text-main', 'Texto principal', '--bg-card'],
  ['--text-muted', 'Texto secundario', '--bg-card'],
  ['--on-brand', 'Texto sobre azul', '--color-calgar-blue'],
  ['--on-danger', 'Texto sobre rojo sólido', '--danger-solid'],
  ['--on-brand', 'Texto sobre azul (hover)', '--brand-hover'],
  ['--on-danger', 'Texto sobre rojo (hover)', '--danger-hover'],
] as const;

function useVars(names: readonly string[]) {
  const [v, setV] = useState<Record<string, string>>({});
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      const probe = document.createElement('span');
      document.body.appendChild(probe);
      const out: Record<string, string> = {};
      for (const n of names) {
        probe.style.color = `var(${n})`;
        const [r = 0, g = 0, b = 0] = (getComputedStyle(probe).color.match(/\d+/g) ?? []).map(Number);
        out[n] = `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
      }
      probe.remove();
      void cs;
      setV(out);
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, [names]);
  return v;
}

function Tabla() {
  const all = [...new Set([...MARCA.map((m) => m[0]), ...DERIVADOS.flatMap((d) => [d[0], d[2]])])];
  const v = useVars(all);
  return (
    <div className="space-y-6 p-2">
      <section>
        <h2 className="mb-2 text-lg font-semibold">Paleta de marca</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {MARCA.map(([n, uso]) => (
            <li key={n} className="flex items-center gap-3 rounded-xl border border-line bg-card p-3">
              <span
                className="h-12 w-12 shrink-0 rounded-lg border border-line"
                style={{ background: `var(${n})` }}
              />
              <span className="text-sm">
                <code>{n}</code> <span className="num text-muted">{v[n]}</span>
                <br />
                {uso}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Pares texto/fondo y contraste (mínimo AA = 4.5)</h2>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Contraste de los pares de color del sistema</caption>
          <thead>
            <tr>
              <th scope="col" className="p-2">
                Token
              </th>
              <th scope="col" className="p-2">
                Uso
              </th>
              <th scope="col" className="p-2">
                Fondo
              </th>
              <th scope="col" className="p-2 text-right">
                Contraste
              </th>
            </tr>
          </thead>
          <tbody>
            {DERIVADOS.map(([fg, uso, bg]) => {
              const ratio = v[fg] && v[bg] ? contrastRatio(v[fg], v[bg]) : 0;
              return (
                <tr key={`${fg}${bg}${uso}`} className="border-t border-line">
                  <td className="p-2">
                    <code>{fg}</code>
                  </td>
                  <td className="p-2">{uso}</td>
                  <td className="p-2">
                    <code>{bg}</code>
                  </td>
                  <td className="num p-2 text-right font-semibold">
                    {ratio.toFixed(2)}:1 {ratio >= 4.5 ? '✔' : '✘'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
export const Colores: StoryObj<typeof meta> = { render: () => <Tabla /> };

export const Tipografia: StoryObj<typeof meta> = {
  render: () => (
    <div className="space-y-2 p-2">
      <p className="text-3xl font-bold">Inter — títulos</p>
      <p className="text-base">Inter — cuerpo de texto con acentos: ñ, á, é, ü.</p>
      <p className="num text-2xl font-semibold">$ 1.234.567,89 · cifras tabulares</p>
      <p className="num text-2xl font-semibold">$ 1.111.111,11 · mismo ancho</p>
    </div>
  ),
};
