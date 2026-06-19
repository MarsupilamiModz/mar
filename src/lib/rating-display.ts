/** Display helpers for mod ratings — avoids showing misleading 0.0 with no reviews. */
export function formatModRating(averageRating: number, reviewCount: number): string {
  if (reviewCount <= 0) return "—";
  if (!averageRating || averageRating <= 0) return "—";
  return averageRating.toFixed(1);
}

export function hasModRatings(reviewCount: number): boolean {
  return reviewCount > 0;
}
