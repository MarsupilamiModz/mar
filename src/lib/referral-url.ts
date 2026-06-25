export function buildReferralRegisterUrl(locale: string, code: string) {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  return `${base}/${locale}/register?ref=${encodeURIComponent(code)}`;
}
