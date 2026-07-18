import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

type Props = {
  children: React.ReactNode;
  label?: string;
};

type State = { error: Error | null };

/** Keeps one broken screen from taking down the whole partner portal. */
export class PartnerErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn('[partner]', this.props.label || 'view', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-12 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <p className="max-w-sm text-sm text-slate-600 dark:text-slate-300">
            Something went wrong on this page. You can keep using the rest of the portal — try again or pick another tab.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
