import { createHash, randomBytes } from "crypto";

const PREFIX = "MARSU";

export function hashLicenseKey(key: string) {
  return createHash("sha256").update(key.toUpperCase().trim()).digest("hex");
}

export function generateLicenseKey() {
  const segment = () => randomBytes(3).toString("hex").toUpperCase();
  return `${PREFIX}-${segment()}-${segment()}-${segment()}`;
}

export function normalizeLicenseKey(key: string) {
  return key.toUpperCase().trim().replace(/\s+/g, "");
}

export function maskLicenseKey(key: string) {
  const n = normalizeLicenseKey(key);
  if (n.length <= 8) return "****";
  return `${n.slice(0, 5)}****${n.slice(-4)}`;
}
