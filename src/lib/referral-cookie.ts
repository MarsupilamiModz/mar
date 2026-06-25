export const REFERRAL_COOKIE = "xm_referral";
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function normalizeReferralCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}
