'use client';

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import Link from 'next/link';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class EditorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('Editor error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex-1 flex items-center justify-center"
          style={{ color: 'var(--foreground)' }}
        >
          <div className="text-center">
            <p style={{ marginBottom: '1rem' }}>
              エディタの読み込みに失敗しました
            </p>
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                justifyContent: 'center',
              }}
            >
              <button
                onClick={() => window.location.reload()}
                className="error-boundary-button"
              >
                ページを再読み込み
              </button>
              <Link href="/" className="error-boundary-button">
                ホームに戻る
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
