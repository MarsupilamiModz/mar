export function isPlaceholderEmail(email: string): boolean {
  return email.endsWith("@auth.local");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !isPlaceholderEmail(email);
}
