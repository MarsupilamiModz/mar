export const CACHE_TAGS = {
  games: "games",
  mods: "mods",
  featured: "featured",
  announcements: "announcements",
  creators: "creators",
  partners: "partners",
  collections: "collections",
  permissions: "permissions",
  discovery: "discovery",
  adminAnalytics: "admin-analytics",
  mod: (slug: string) => `mod-${slug}`,
  user: (userId: string) => `user-${userId}`,
  userSession: (supabaseId: string) => `session-${supabaseId}`,
  achievements: (userId: string) => `achievements-${userId}`,
} as const;

export const REVALIDATE = {
  homepage: 120,
  catalog: 60,
  modDetail: 30,
  collections: 60,
  authProfile: 30,
  permissions: 120,
  branding: 60,
  static: 3600,
  search: 60,
  adminStats: 60,
} as const;
