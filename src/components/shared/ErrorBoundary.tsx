import { Component, type ReactNode } from 'react';
import i18n from '@/i18n';

/** No registra el error con datos de usuario; solo muestra un mensaje seguro. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? (
      <div role="alert" className="m-6 rounded-xl border border-line bg-card p-6 text-fg">
        <h1 className="text-lg font-semibold">{i18n.t('Algo salió mal')}</h1>
        <p className="mt-1 text-sm text-muted">
          {i18n.t('Recarga la página. Si el problema continúa, contacta al banco.')}
        </p>
      </div>
    ) : (
      this.props.children
    );
  }
}
