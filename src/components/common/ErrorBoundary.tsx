import * as React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('FarmDesk UI error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-xl font-bold">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {this.state.message || 'The page could not be displayed. Your saved data is not affected.'}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Button onClick={() => window.location.reload()}>
                <RotateCcw className="h-4 w-4" /> Reload FarmDesk
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
