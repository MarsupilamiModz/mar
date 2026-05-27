"use client";

import * as React from "react";

type Toast = {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
};

type State = { toasts: Toast[] };

const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

function dispatch(action: { type: "ADD"; toast: Toast } | { type: "DISMISS"; id: string }) {
  if (action.type === "ADD") {
    memoryState = { toasts: [...memoryState.toasts, action.toast] };
  } else {
    memoryState = { toasts: memoryState.toasts.filter((t) => t.id !== action.id) };
  }
  listeners.forEach((l) => l(memoryState));
}

export function toast({ title, description, variant = "default" }: Omit<Toast, "id">) {
  const id = Math.random().toString(36).slice(2);
  dispatch({ type: "ADD", toast: { id, title, description, variant } });
  setTimeout(() => dispatch({ type: "DISMISS", id }), 4000);
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState);
  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const i = listeners.indexOf(setState);
      if (i > -1) listeners.splice(i, 1);
    };
  }, []);
  return { toasts: state.toasts, dismiss: (id: string) => dispatch({ type: "DISMISS", id }) };
}
