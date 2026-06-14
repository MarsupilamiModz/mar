"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  title?: string;
  children: React.ReactNode;
};

type State = { error: Error | null };

export class AdminSafeBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[admin-section-error]", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <h3 className="font-semibold">{this.props.title ?? "Section unavailable"}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            This section failed to load. Other admin tools should still work.
          </p>
          {this.state.error.message && (
            <p className="mt-2 text-xs text-muted-foreground/80 break-words max-w-md mx-auto">
              {this.state.error.message}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => this.setState({ error: null })}
          >
            Retry section
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
