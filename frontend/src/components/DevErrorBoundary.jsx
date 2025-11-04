import React from 'react';

export default class DevErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // يسجل التفاصيل في الكونسول أيضًا
    console.error('⚠️ Runtime error caught by DevErrorBoundary:', error, info);
    this.setState({ info });
  }

  render() {
    const { error, info } = this.state;
    if (error) {
      return (
        <div style={{ padding: 24, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
          <h2 style={{ marginTop: 0 }}>Something went wrong while rendering.</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
{String(error?.message || error)}
          </pre>
          {info?.componentStack && (
            <>
              <h3>Component stack</h3>
              <pre style={{ whiteSpace: 'pre-wrap' }}>
{info.componentStack}
              </pre>
            </>
          )}
          <p style={{ color: '#666' }}>
            Open the browser console for more details. Fix the error above and the app will hot-reload.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
