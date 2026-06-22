export const ADMIN_PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100, 250] as const;
export type AdminPageSize = (typeof ADMIN_PAGE_SIZE_OPTIONS)[number];
export const DEFAULT_ADMIN_PAGE_SIZE: AdminPageSize = 25;

export function parseAdminPage(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function parseAdminLimit(value: string | undefined): AdminPageSize {
  const n = Number(value);
  if (ADMIN_PAGE_SIZE_OPTIONS.includes(n as AdminPageSize)) {
    return n as AdminPageSize;
  }
  return DEFAULT_ADMIN_PAGE_SIZE;
}

export function clampAdminLimit(limit?: number): AdminPageSize {
  if (!limit) return DEFAULT_ADMIN_PAGE_SIZE;
  const allowed = ADMIN_PAGE_SIZE_OPTIONS as readonly number[];
  if (allowed.includes(limit)) return limit as AdminPageSize;
  if (limit < 10) return 10;
  return 250;
}

export function buildAdminQueryString(
  base: Record<string, string | undefined>,
  patch: Record<string, string | number | undefined>
): string {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries({ ...base, ...patch })) {
    if (val !== undefined && val !== "" && val !== "all") {
      params.set(key, String(val));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
