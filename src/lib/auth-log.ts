type AuthLogPayload = Record<string, unknown>;

/** Structured auth events for production debugging (no secrets). */
export function logAuthEvent(
  event: string,
  payload?: AuthLogPayload,
  level: "info" | "warn" | "error" = "info"
) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    scope: "auth",
    event,
    ...payload,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
