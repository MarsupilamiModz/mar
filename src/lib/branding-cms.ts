import { getSiteSetting, setSiteSettingSafe } from "@/lib/site-settings";
import type { Locale } from "@/i18n/config";
import { locales } from "@/i18n/config";

/** SiteSetting keys — logical tables for branding CMS */
export const CMS_KEYS = {
  branding: "branding_settings",
  header: "header_settings",
  footer: "footer_settings",
  seo: "seo_settings",
  pageContent: "page_content",
} as const;

export type SiteSymbolMode = "letter" | "image" | "library";

export type BrandingAssetSettings = {
  siteTitle: string;
  siteShortName: string;
  browserTitle: string;
  siteTagline: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  appleTouchIconUrl: string | null;
  androidIconUrl: string | null;
  pwaIconUrl: string | null;
  loadingLogoUrl: string | null;
  mobileIconUrl: string | null;
  siteSymbolMode: SiteSymbolMode;
  siteSymbolLetter: string;
  siteSymbolUrl: string | null;
  siteSymbolLibrary: string | null;
  siteSymbolColor: string;
  logoObjectPosition: string;
  footerText: string | null;
  primaryColor: string;
  accentColor: string;
};

export type HeaderMenuItem = {
  id: string;
  label: string;
  href: string;
  hidden: boolean;
  order: number;
};

export type HeaderSettings = {
  menuItems: HeaderMenuItem[];
  backgroundColor: string;
  transparent: boolean;
  blur: boolean;
  sticky: boolean;
  height: number;
  mobileMenuExpanded: boolean;
};

export type FooterLink = {
  id: string;
  label: string;
  href: string;
  order: number;
};

export type FooterSection = {
  id: string;
  title: string;
  order: number;
  links: FooterLink[];
};

export type FooterSettings = {
  sections: FooterSection[];
  copyright: string;
  tagline: string;
  socialLinks: { discord?: string; twitter?: string; youtube?: string; tiktok?: string };
};

export type SeoLocaleSettings = {
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string | null;
  twitterCard: "summary" | "summary_large_image";
};

export type SeoSettings = {
  global: SeoLocaleSettings;
  locales: Partial<Record<Locale, Partial<SeoLocaleSettings>>>;
};

export type PageId =
  | "homepage"
  | "premium"
  | "shop"
  | "games"
  | "mods"
  | "creators"
  | "partners"
  | "support"
  | "become-creator"
  | "become-partner";

export type LocalizedPageFields = Record<string, string>;

export type PageContentStore = Partial<
  Record<PageId, Partial<Record<Locale, LocalizedPageFields>>>
>;

export const ICON_LIBRARY = [
  { id: "sparkles", label: "Sparkles" },
  { id: "crown", label: "Crown" },
  { id: "gamepad", label: "Gamepad" },
  { id: "zap", label: "Zap" },
  { id: "star", label: "Star" },
  { id: "flame", label: "Flame" },
  { id: "shield", label: "Shield" },
  { id: "rocket", label: "Rocket" },
] as const;

export const DEFAULT_HEADER_MENU: HeaderMenuItem[] = [
  { id: "games", label: "Games", href: "/games", hidden: false, order: 0 },
  { id: "mods", label: "Mods", href: "/mods", hidden: false, order: 1 },
  { id: "collections", label: "Collections", href: "/collections", hidden: false, order: 2 },
  { id: "tutorials", label: "Tutorials", href: "/tutorials", hidden: false, order: 3 },
  { id: "creators", label: "Creators", href: "/creators", hidden: false, order: 3 },
  { id: "partners", label: "Partners", href: "/partners", hidden: false, order: 4 },
  { id: "shop", label: "Shop", href: "/shop", hidden: false, order: 5 },
  { id: "leaderboards", label: "Leaderboards", href: "/leaderboards", hidden: false, order: 6 },
  { id: "premium", label: "Premium", href: "/premium", hidden: false, order: 7 },
  { id: "custom-orders", label: "Custom Orders", href: "/custom-orders", hidden: false, order: 8 },
];

export const DEFAULT_BRANDING_ASSETS: BrandingAssetSettings = {
  siteTitle: "Xumari Modz",
  siteShortName: "Xumari",
  browserTitle: "Xumari Modz — Premium Gaming Mods",
  siteTagline: "Premium gaming mods marketplace",
  logoUrl: null,
  logoDarkUrl: null,
  faviconUrl: null,
  appleTouchIconUrl: null,
  androidIconUrl: null,
  pwaIconUrl: null,
  loadingLogoUrl: null,
  mobileIconUrl: null,
  siteSymbolMode: "letter",
  siteSymbolLetter: "X",
  siteSymbolUrl: null,
  siteSymbolLibrary: "sparkles",
  siteSymbolColor: "#a855f7",
  logoObjectPosition: "center",
  footerText: "© Xumari Modz. All rights reserved.",
  primaryColor: "#a855f7",
  accentColor: "#3b82f6",
};

export const DEFAULT_HEADER: HeaderSettings = {
  menuItems: DEFAULT_HEADER_MENU,
  backgroundColor: "",
  transparent: true,
  blur: true,
  sticky: true,
  height: 64,
  mobileMenuExpanded: false,
};

export const DEFAULT_FOOTER: FooterSettings = {
  sections: [
    {
      id: "platform",
      title: "Platform",
      order: 0,
      links: [
        { id: "mods", label: "Browse Mods", href: "/mods", order: 0 },
        { id: "games", label: "Games", href: "/games", order: 1 },
        { id: "premium", label: "Premium", href: "/premium", order: 2 },
      ],
    },
    {
      id: "support",
      title: "Support",
      order: 1,
      links: [
        { id: "support", label: "Support", href: "/dashboard/support", order: 0 },
        { id: "faq", label: "FAQ", href: "/faq", order: 1 },
        { id: "contact", label: "Contact", href: "/contact", order: 2 },
      ],
    },
    {
      id: "legal",
      title: "Legal",
      order: 2,
      links: [
        { id: "terms", label: "Terms", href: "/legal/terms", order: 0 },
        { id: "privacy", label: "Privacy", href: "/legal/privacy", order: 1 },
        { id: "dmca", label: "DMCA", href: "/legal/dmca", order: 2 },
      ],
    },
  ],
  copyright: "All rights reserved.",
  tagline: "Premium mods marketplace for serious gamers",
  socialLinks: {
    discord: "https://discord.gg/xumarimodz",
    twitter: "https://twitter.com/xumarimodz",
  },
};

export const DEFAULT_SEO: SeoSettings = {
  global: {
    metaTitle: "Xumari Modz — Premium Gaming Mods Marketplace",
    metaDescription:
      "Discover, download, and support premium mods for GTA V, FiveM, Minecraft, ETS2, BeamNG, Assetto Corsa and more.",
    ogTitle: "Xumari Modz",
    ogDescription: "Premium gaming mods marketplace",
    ogImageUrl: null,
    twitterCard: "summary_large_image",
  },
  locales: {},
};

export const PAGE_CONTENT_FIELDS: Record<PageId, string[]> = {
  homepage: [
    "heroBadge",
    "heroTitle",
    "heroSubtitle",
    "browseMods",
    "goPremium",
    "premiumBanner",
    "premiumBannerDesc",
    "statsMods",
    "statsGames",
    "statsCreators",
  ],
  premium: ["heroTitle", "heroSubtitle", "ctaText", "featuresIntro", "benefitsIntro"],
  shop: ["heroTitle", "heroSubtitle", "categoryIntro"],
  games: ["introText", "featuredText", "seoContent"],
  mods: ["defaultDescription", "warningText", "downloadNotice", "installNotice"],
  creators: ["introTitle", "introText", "explanationText"],
  partners: ["introTitle", "introText", "requirementsText", "commissionText"],
  support: ["introText", "faqIntro", "ticketInstructions"],
  "become-creator": ["heroTitle", "heroSubtitle", "applicationIntro"],
  "become-partner": ["heroTitle", "heroSubtitle", "applicationIntro"],
};

async function readLegacyBranding(): Promise<Partial<BrandingAssetSettings>> {
  const legacy = await getSiteSetting<Partial<BrandingAssetSettings>>("branding", {});
  return legacy;
}

export async function getBrandingAssetSettings(): Promise<BrandingAssetSettings> {
  const [stored, legacy] = await Promise.all([
    getSiteSetting<Partial<BrandingAssetSettings>>(CMS_KEYS.branding, {}),
    readLegacyBranding(),
  ]);
  return { ...DEFAULT_BRANDING_ASSETS, ...legacy, ...stored };
}

export async function saveBrandingAssetSettings(settings: BrandingAssetSettings) {
  const saved = await setSiteSettingSafe(CMS_KEYS.branding, settings);
  if (!saved.ok) throw new Error(saved.error);
  await setSiteSettingSafe("branding", settings);
}

export async function getHeaderSettings() {
  return getSiteSetting<HeaderSettings>(CMS_KEYS.header, DEFAULT_HEADER);
}

export async function saveHeaderSettings(settings: HeaderSettings) {
  const saved = await setSiteSettingSafe(CMS_KEYS.header, settings);
  if (!saved.ok) throw new Error(saved.error);
}

export async function getFooterSettings() {
  return getSiteSetting<FooterSettings>(CMS_KEYS.footer, DEFAULT_FOOTER);
}

export async function saveFooterSettings(settings: FooterSettings) {
  const saved = await setSiteSettingSafe(CMS_KEYS.footer, settings);
  if (!saved.ok) throw new Error(saved.error);
}

export async function getSeoSettings() {
  return getSiteSetting<SeoSettings>(CMS_KEYS.seo, DEFAULT_SEO);
}

export async function saveSeoSettings(settings: SeoSettings) {
  const saved = await setSiteSettingSafe(CMS_KEYS.seo, settings);
  if (!saved.ok) throw new Error(saved.error);
}

export async function getPageContentStore() {
  return getSiteSetting<PageContentStore>(CMS_KEYS.pageContent, {});
}

export async function savePageContentStore(store: PageContentStore) {
  const saved = await setSiteSettingSafe(CMS_KEYS.pageContent, store);
  if (!saved.ok) throw new Error(saved.error);
}

export function resolvePageContent(
  store: PageContentStore,
  page: PageId,
  locale: Locale,
  field: string,
  fallback: string
): string {
  const pageData = store[page];
  if (!pageData) return fallback;
  const localized = pageData[locale]?.[field];
  if (localized?.trim()) return localized;
  const en = pageData.en?.[field];
  if (en?.trim()) return en;
  return fallback;
}

export function resolveSeoForLocale(settings: SeoSettings, locale: Locale): SeoLocaleSettings {
  const override = settings.locales[locale] ?? {};
  return { ...settings.global, ...override };
}

export type PublicBrandingBundle = {
  branding: BrandingAssetSettings;
  header: HeaderSettings;
  footer: FooterSettings;
  seo: SeoSettings;
  pageContent: PageContentStore;
};

export async function loadPublicBrandingBundle(): Promise<PublicBrandingBundle> {
  const [branding, header, footer, seo, pageContent] = await Promise.all([
    getBrandingAssetSettings(),
    getHeaderSettings(),
    getFooterSettings(),
    getSeoSettings(),
    getPageContentStore(),
  ]);
  return { branding, header, footer, seo, pageContent };
}

export function syncIconVariantsFromFavicon(
  branding: BrandingAssetSettings,
  faviconUrl: string
): BrandingAssetSettings {
  return {
    ...branding,
    faviconUrl,
    appleTouchIconUrl: faviconUrl,
    androidIconUrl: faviconUrl,
    pwaIconUrl: faviconUrl,
    mobileIconUrl: faviconUrl,
  };
}

export const SUPPORTED_LOCALES = locales;
