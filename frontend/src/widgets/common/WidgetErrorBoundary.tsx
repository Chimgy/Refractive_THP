import { Component, type ReactNode } from 'react';

type Props = {
  widgetTitle: string;
  onRemove?: () => void;
  children: ReactNode;
};

type State = { hasError: boolean };

// Isolates a single widget's render crash so it can't take the whole
// dashboard down — in practice the likeliest cause is a persisted widget
// config left over from an older version of that widget's shape.
export default class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error(
      `Widget "${this.props.widgetTitle}" failed to render:`,
      error,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="dashed"
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: 16,
            textAlign: 'center',
          }}
        >
          <span
            className="mono"
            style={{ fontSize: 11.5, color: 'var(--bad)' }}
          >
            &ldquo;{this.props.widgetTitle}&rdquo; failed to render
          </span>
          <span
            className="mono faint"
            style={{ fontSize: 10.5, maxWidth: 220 }}
          >
            Its saved config is likely out of date.
          </span>
          {this.props.onRemove && (
            <button
              type="button"
              className="btn"
              style={{ height: 28, fontSize: 11 }}
              onClick={this.props.onRemove}
            >
              Remove widget
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
