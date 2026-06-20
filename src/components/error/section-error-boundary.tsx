"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorRecoveryPanelContent } from "@/components/error/error-recovery-panel";
import { parseAppError } from "@/lib/error-diagnostics";

type Props = {
  children: ReactNode;
  title?: string;
  compact?: boolean;
};

type State = {
  error: Error | null;
};

export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[section-error-boundary]", error, info);
  }

  render() {
    if (this.state.error) {
      const diagnostics = parseAppError(this.state.error, { fallbackTitle: this.props.title });
      return (
        <ErrorRecoveryPanelContent
          diagnostics={diagnostics}
          labels={{
            titleNetwork: "Connection problem",
            titleAuth: "Session issue",
            titleDatabase: "Database temporarily unavailable",
            titleUpload: "Upload interrupted",
            titlePermission: "Access denied",
            titleValidation: "Invalid request",
            retry: "Try again",
            reload: "Reload page",
            signIn: "Sign in again",
            home: "Back to home",
            copyDetails: "Copy details",
            copied: "Copied",
            detailsLabel: "Technical details",
            codeLabel: "Code",
            referenceLabel: "Reference",
            categoryLabel: "Category",
          }}
          compact={this.props.compact}
          onRetry={() => this.setState({ error: null })}
        />
      );
    }

    return this.props.children;
  }
}
