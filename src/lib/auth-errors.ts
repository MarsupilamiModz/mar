export type AuthErrorCode =
  | "rate_limit_exceeded"
  | "email_rate_limit_exceeded"
  | "auth_error"
  | "smtp_error"
  | "verification_error"
  | "user_exists"
  | "invalid_credentials"
  | "weak_password"
  | "bot_detected"
  | "generic";

const RATE_LIMIT_PATTERNS = [
  /rate limit/i,
  /too many requests/i,
  /email rate limit/i,
  /over_email_send_rate_limit/i,
];

const USER_EXISTS_PATTERNS = [
  /already registered/i,
  /already been registered/i,
  /user already exists/i,
  /email address is already/i,
];

const WEAK_PASSWORD_PATTERNS = [/password.*at least/i, /weak password/i, /password is too/i];

const INVALID_CREDENTIALS_PATTERNS = [/invalid login credentials/i, /invalid email or password/i];

export function classifyAuthError(raw: string): AuthErrorCode {
  const msg = raw.toLowerCase();
  if (RATE_LIMIT_PATTERNS.some((p) => p.test(msg))) {
    return msg.includes("email") ? "email_rate_limit_exceeded" : "rate_limit_exceeded";
  }
  if (USER_EXISTS_PATTERNS.some((p) => p.test(msg))) return "user_exists";
  if (WEAK_PASSWORD_PATTERNS.some((p) => p.test(msg))) return "weak_password";
  if (INVALID_CREDENTIALS_PATTERNS.some((p) => p.test(msg))) return "invalid_credentials";
  if (/smtp|mail delivery|email provider/i.test(msg)) return "smtp_error";
  if (/verif/i.test(msg)) return "verification_error";
  return "auth_error";
}

const MESSAGES: Record<AuthErrorCode, Record<string, string>> = {
  rate_limit_exceeded: {
    en: "Too many attempts. Please wait a few minutes and try again.",
    de: "Zu viele Versuche. Bitte warte einige Minuten und versuche es erneut.",
  },
  email_rate_limit_exceeded: {
    en: "Please check your inbox — we sent a verification email if your address is valid.",
    de: "Bitte überprüfe dein Postfach — falls die Adresse gültig ist, haben wir dir eine Bestätigungs-E-Mail gesendet.",
  },
  auth_error: {
    en: "Something went wrong. Please try again.",
    de: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
  },
  smtp_error: {
    en: "Please check your inbox — we sent a verification email if your address is valid.",
    de: "Bitte überprüfe dein Postfach — falls die Adresse gültig ist, haben wir dir eine Bestätigungs-E-Mail gesendet.",
  },
  verification_error: {
    en: "Please check your inbox to verify your email address.",
    de: "Bitte überprüfe dein Postfach, um deine E-Mail-Adresse zu bestätigen.",
  },
  user_exists: {
    en: "An account with this email already exists. Try signing in instead.",
    de: "Ein Konto mit dieser E-Mail existiert bereits. Bitte melde dich an.",
  },
  invalid_credentials: {
    en: "Invalid email or password.",
    de: "Ungültige E-Mail oder Passwort.",
  },
  weak_password: {
    en: "Password must be at least 8 characters.",
    de: "Das Passwort muss mindestens 8 Zeichen lang sein.",
  },
  bot_detected: {
    en: "Verification failed. Please try again.",
    de: "Verifizierung fehlgeschlagen. Bitte versuche es erneut.",
  },
  generic: {
    en: "Something went wrong. Please try again.",
    de: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
  },
};

export function userFriendlyAuthMessage(
  raw: string | null | undefined,
  locale = "en",
  fallback: AuthErrorCode = "generic"
): string {
  if (!raw?.trim()) return MESSAGES[fallback][locale] ?? MESSAGES[fallback].en;
  const code = classifyAuthError(raw);
  return MESSAGES[code][locale] ?? MESSAGES[code].en;
}

export function userFriendlyAuthCodeMessage(code: AuthErrorCode, locale = "en"): string {
  return MESSAGES[code][locale] ?? MESSAGES[code].en;
}
