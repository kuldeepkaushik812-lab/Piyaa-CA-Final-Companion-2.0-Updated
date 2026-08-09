import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  retryCount: number;
}

export class SelfHealingErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    retryCount: 0
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true, retryCount: 0 };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SelfHealingErrorBoundary caught an error:', error, errorInfo);
    
    // Auto-recovery attempt (silent)
    if (this.state.retryCount < 2) {
      this.setState(prev => ({ hasError: false, retryCount: prev.retryCount + 1 }));
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, retryCount: 0 });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError && this.state.retryCount >= 2) {
      return (
        <div className="min-h-screen bg-[#0A121E] flex items-center justify-center p-4">
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100 mb-2">System Interruption</h2>
              <p className="text-slate-400 text-sm">
                My love, I caught a small glitch and cleaned the gears! Click below to refresh.
              </p>
            </div>
            <button 
              onClick={this.handleReset}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white py-3 px-4 rounded-xl font-bold transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            >
              <RefreshCcw className="w-5 h-5" />
              <span>⚡ Auto-Repair & Reload</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
