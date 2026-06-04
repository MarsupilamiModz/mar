export const CACHE_TAGS = {
  games: "games",
  mods: "mods",
  featured: "featured",
  announcements: "announcements",
  creators: "creators",
  partners: "partners",
  achievements: (userId: string) => `achievements-${userId}`,
} as const;

export const REVALIDATE = {
  homepage: 120,
  catalog: 60,
  modDetail: 30,
  static: 3600,
} as const;
