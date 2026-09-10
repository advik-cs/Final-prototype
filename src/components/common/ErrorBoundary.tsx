import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends (Component as new (...args: any[]) => any) {
  state: State = {
    hasError: false,
    error: null,
  };

  constructor(props: Props) {
    super(props);
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: any) {
    console.error('[ErrorBoundary caught exception]:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[420px] flex items-center justify-center p-8 bg-red-50/70 rounded-3xl border border-red-200 m-4 shadow-sm">
          <div className="max-w-md text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4 text-red-600 shadow-inner">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-red-900 mb-2 font-['Space_Grotesk',sans-serif]">
              {this.props.fallbackTitle || 'Unable to display Map Intelligence'}
            </h3>
            <p className="text-xs text-red-700 mb-5 leading-relaxed">
              {this.props.fallbackMessage ||
                this.state.error?.message ||
                'A runtime exception occurred while rendering the map components.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-4 py-2 bg-[#2F4156] hover:bg-[#1F2D3D] text-white text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Map View</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
