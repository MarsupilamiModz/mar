/** Capitalize first letter of each word segment (handles underscores/hyphens). */
function capitalizeSegment(segment: string): string {
  if (!segment) return segment;
  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
}

/** Format raw username for display — no @ prefix, capitalized. */
export function formatUsername(username: string): string {
  return username
    .replace(/^@+/, "")
    .split(/[-_]/)
    .map(capitalizeSegment)
    .join("");
}

/** Primary display label for a user profile. */
export function formatDisplayName(user: {
  displayName?: string | null;
  username: string;
}): string {
  if (user.displayName?.trim()) {
    return user.displayName.trim();
  }
  return formatUsername(user.username);
}

/** Optional secondary handle (never prefixed with @). */
export function formatHandle(username: string): string {
  return formatUsername(username);
}
