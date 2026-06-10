"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Catches render-time errors in the active view so a single broken
// page (e.g. Mesa de trabajo, Chat) shows an inline message instead of
// leaving the whole app blank/frozen. The shell (Topbar/Sidebar) stays
// usable so the user can navigate away.
export class ViewErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[ViewErrorBoundary]", error, info.componentStack);
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.children !== this.props.children) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card" style={{ padding: 16, borderLeft: "3px solid var(--red, #dc2626)" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 4 }}>
            Esta sección tuvo un error y no se pudo mostrar.
          </p>
          <p style={{ fontSize: 12, color: "var(--t2)" }}>
            {this.state.error.message || "Error desconocido."} Puedes navegar a otra sección o recargar la página.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
